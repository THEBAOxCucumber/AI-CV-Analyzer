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

  try {
    const response =
      await gemini.models.embedContent({
        model: env.embedding.model,
        contents: normalizedTexts,
        config: {
          taskType,
          outputDimensionality:
            env.embedding.dimensions,
        },
      });

    const embeddings = response.embeddings ?? [];

    if (embeddings.length !== normalizedTexts.length) {
      throw new AppError(
        "จำนวน Embedding ไม่ตรงกับจำนวนข้อความ",
        500,
        "EMBEDDING_RESULT_COUNT_MISMATCH",
        {
          expected: normalizedTexts.length,
          received: embeddings.length,
        },
      );
    }

    return embeddings.map((item, index) => {
      const values = item.values;

      if (!values) {
        throw new AppError(
          `ไม่พบ Vector ของข้อความลำดับที่ ${index}`,
          500,
          "EMBEDDING_VECTOR_MISSING",
        );
      }

      if (
        values.length !==
        env.embedding.dimensions
      ) {
        throw new AppError(
          "ขนาด Embedding ไม่ตรงกับที่กำหนด",
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