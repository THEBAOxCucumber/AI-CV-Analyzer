import { Ollama } from "ollama";

import { env } from "../../config/env.js";
import { gemini } from "../../config/gemini.js";
import { AppError } from "../../errors/app-error.js";

export type EmbeddingTaskType =
  | "RETRIEVAL_DOCUMENT"
  | "RETRIEVAL_QUERY";

export interface EmbeddingResult {
  embedding: number[];
  model: string;
  dimensions: number;
}

interface GeminiErrorDetails {
  status?: number;
  code?: number | string;
  message?: string;
}

function getGeminiErrorDetails(
  error: unknown,
): GeminiErrorDetails {
  if (typeof error !== "object" || error === null) {
    return {};
  }

  return error as GeminiErrorDetails;
}

/*
 * qwen3-embedding: คำค้นต้องมีคำสั่งนำหน้า เอกสารไม่ต้อง (ตามคู่มือโมเดล)
 * โมเดลอื่นที่ไม่ต้องใช้ก็ไม่เสียหาย — ใช้เฉพาะฝั่ง query
 */
const OLLAMA_QUERY_INSTRUCTION =
  "Instruct: Given a question about a candidate, retrieve resume passages that answer it\nQuery: ";

let ollamaClient: Ollama | null = null;

function getOllama(): Ollama {
  ollamaClient ??= new Ollama({ host: env.ollama.host });
  return ollamaClient;
}

async function embedWithGemini(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> {
  try {
    const response =
      await gemini.models.embedContent({
        model: env.embedding.model,
        contents: texts,
        config: {
          taskType,
          outputDimensionality:
            env.embedding.dimensions,
        },
      });

    return (response.embeddings ?? []).map((item, index) => {
      if (!item.values) {
        throw new AppError(
          `ไม่พบ Vector ของข้อความลำดับที่ ${index}`,
          500,
          "EMBEDDING_VECTOR_MISSING",
        );
      }

      return item.values;
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("Gemini embedding error:", error);

    const details = getGeminiErrorDetails(error);

    if (
      details.status === 401 ||
      details.status === 403
    ) {
      throw new AppError(
        "Gemini API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้งาน",
        502,
        "GEMINI_AUTHENTICATION_FAILED",
      );
    }

    if (details.status === 429) {
      throw new AppError(
        "Gemini API ถูกจำกัดโควตาหรือมีการเรียกใช้งานมากเกินไป",
        429,
        "GEMINI_RATE_LIMITED",
      );
    }

    throw new AppError(
      "ไม่สามารถสร้าง Gemini Embedding ได้",
      502,
      "EMBEDDING_API_FAILED",
    );
  }
}

async function embedWithOllama(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<number[][]> {
  const input =
    taskType === "RETRIEVAL_QUERY"
      ? texts.map((text) => OLLAMA_QUERY_INSTRUCTION + text)
      : texts;

  try {
    const response =
      await getOllama().embed({
        model: env.embedding.model,
        input,
        truncate: true,
        keep_alive: env.ollama.keepAlive,
        options: {
          num_gpu: env.embedding.ollamaNumGpu,
        },
      });

    return response.embeddings;
  } catch (error) {
    console.error("Ollama embedding error:", error);

    const message =
      error instanceof Error ? error.message : String(error);

    if (/not found|pull/i.test(message)) {
      throw new AppError(
        `ไม่พบโมเดล Embedding ใน Ollama — รัน: ollama pull ${env.embedding.model}`,
        502,
        "EMBEDDING_MODEL_NOT_FOUND",
      );
    }

    throw new AppError(
      "ไม่สามารถสร้าง Embedding ด้วย Ollama ได้ (ตรวจว่า Ollama ทำงานอยู่)",
      502,
      "EMBEDDING_API_FAILED",
    );
  }
}

async function embedTexts(
  texts: string[],
  taskType: EmbeddingTaskType,
): Promise<EmbeddingResult[]> {
  if (texts.length === 0) {
    return [];
  }

  const normalizedTexts = texts.map((text) =>
    text.trim(),
  );

  if (normalizedTexts.some((text) => !text)) {
    throw new AppError(
      "พบข้อความว่างสำหรับสร้าง Embedding",
      422,
      "EMPTY_EMBEDDING_INPUT",
    );
  }

  let vectors: number[][];

  switch (env.embedding.provider) {
    case "gemini":
      vectors = await embedWithGemini(normalizedTexts, taskType);
      break;

    case "ollama":
      vectors = await embedWithOllama(normalizedTexts, taskType);
      break;

    default:
      throw new AppError(
        `EMBEDDING_PROVIDER ไม่รองรับ: ${env.embedding.provider} (ใช้ gemini หรือ ollama)`,
        500,
        "EMBEDDING_PROVIDER_UNSUPPORTED",
      );
  }

  if (vectors.length !== normalizedTexts.length) {
    throw new AppError(
      "จำนวน Embedding ไม่ตรงกับจำนวนข้อความ",
      500,
      "EMBEDDING_RESULT_COUNT_MISMATCH",
      {
        expected: normalizedTexts.length,
        received: vectors.length,
      },
    );
  }

  return vectors.map((values) => {
    if (
      values.length !==
      env.embedding.dimensions
    ) {
      throw new AppError(
        "ขนาด Embedding ไม่ตรงกับที่กำหนด (ตรวจ EMBEDDING_DIMENSIONS)",
        500,
        "EMBEDDING_DIMENSION_MISMATCH",
        {
          expected: env.embedding.dimensions,
          received: values.length,
        },
      );
    }

    return {
      embedding: values,
      model: env.embedding.model,
      dimensions: values.length,
    };
  });
}

/**
 * ใช้ตอนนำ Resume Chunk เข้า Vector Database
 */
export async function createDocumentEmbeddings(
  texts: string[],
): Promise<EmbeddingResult[]> {
  return embedTexts(
    texts,
    "RETRIEVAL_DOCUMENT",
  );
}

/**
 * ใช้ตอนแปลงคำถามสำหรับค้นหา
 */
export async function createQueryEmbedding(
  query: string,
): Promise<EmbeddingResult> {
  const results = await embedTexts(
    [query],
    "RETRIEVAL_QUERY",
  );

  const embedding = results[0];

  if (!embedding) {
    throw new AppError(
      "ไม่พบ Query Embedding",
      500,
      "QUERY_EMBEDDING_MISSING",
    );
  }

  return embedding;
}
