import { env } from "../../config/env.js";
import { qdrant } from "../../config/qdrant.js";
import { AppError } from "../../errors/app-error.js";
import type { ResumeSection } from "../resume/resume-chunk.types.js";
import type { Schemas } from "@qdrant/js-client-rest";

export interface ResumeVectorPayload {
  [key: string]:
    | string
    | number
    | boolean
    | null
    | undefined;

  chunkId: number;
  resumeId: number;
  userId: number;
  section: ResumeSection;
  chunkIndex: number;
  content: string;
  embeddingModel: string;
}

export interface ResumeVectorPoint {
  id: string;
  vector: number[];
  payload: Schemas["Payload"];
}

/**
 * ตรวจว่ามี Collection หรือยัง
 * ถ้ายังไม่มี จะสร้างให้อัตโนมัติ
 */
export async function ensureResumeVectorCollection(): Promise<void> {
  const collectionName = env.qdrant.collection;

  try {
    await qdrant.getCollection(collectionName);
  } catch (error) {
    if (!isQdrantNotFoundError(error)) {
      throw error;
    }

    await qdrant.createCollection(collectionName, {
      vectors: {
        size: env.embedding.dimensions,
        distance: "Cosine",
        on_disk: true,
      },
      on_disk_payload: true,
    });
  }
}

function isQdrantNotFoundError(error: unknown): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const candidate = error as {
    status?: number;
    statusCode?: number;
  };

  return (
    candidate.status === 404 ||
    candidate.statusCode === 404
  );
}

export async function upsertResumeVectors(
  points: ResumeVectorPoint[],
): Promise<void> {
  if (points.length === 0) {
    return;
  }

  await ensureResumeVectorCollection();

  try {
    await qdrant.upsert(
      env.qdrant.collection,
      {
        wait: true,
        points: points.map((point) => ({
          id: point.id,
          vector: point.vector,
          payload: point.payload,
        })),
      },
    );
  } catch (error) {
    console.error("Qdrant upsert error:", error);

    throw new AppError(
      "ไม่สามารถบันทึก Vector ลง Vector Database ได้",
      502,
      "VECTOR_DATABASE_UPSERT_FAILED",
    );
  }
}

export async function deleteResumeVectors(
  resumeId: number,
  userId: number,
): Promise<void> {
  await ensureResumeVectorCollection();

  await qdrant.delete(env.qdrant.collection, {
    wait: true,
    filter: {
      must: [
        {
          key: "resumeId",
          match: {
            value: resumeId,
          },
        },
        {
          key: "userId",
          match: {
            value: userId,
          },
        },
      ],
    },
  });
}

export interface SearchResumeVectorsInput {
  vector: number[];
  userId: number;
  resumeId: number;
  limit: number;
  scoreThreshold?: number;
}

export interface ResumeVectorSearchResult {
  pointId: string | number;
  chunkId: number;
  resumeId: number;
  userId: number;
  section: ResumeSection;
  chunkIndex: number;
  content: string;
  score: number;
  embeddingModel: string | null;
}

export async function searchResumeVectors(
  input: SearchResumeVectorsInput,
): Promise<ResumeVectorSearchResult[]> {
  await ensureResumeVectorCollection();

  try {
    const result = await qdrant.query(
      env.qdrant.collection,
      {
        query: input.vector,

        filter: {
          must: [
            {
              key: "userId",
              match: {
                value: input.userId,
              },
            },
            {
              key: "resumeId",
              match: {
                value: input.resumeId,
              },
            },
          ],
        },

        limit: input.limit,
        score_threshold: input.scoreThreshold,
        with_payload: true,
        with_vector: false,
      },
    );

    return result.points.map((point) => {
      const payload = point.payload ?? {};

      const chunkId = payload.chunkId;
      const resumeId = payload.resumeId;
      const userId = payload.userId;
      const section = payload.section;
      const chunkIndex = payload.chunkIndex;
      const content = payload.content;
      const embeddingModel =
        payload.embeddingModel;

      if (
        typeof chunkId !== "number" ||
        typeof resumeId !== "number" ||
        typeof userId !== "number" ||
        typeof chunkIndex !== "number" ||
        typeof content !== "string" ||
        typeof section !== "string"
      ) {
        throw new AppError(
          "Payload จาก Vector Database ไม่ถูกต้อง",
          500,
          "INVALID_VECTOR_PAYLOAD",
        );
      }

      return {
        pointId: point.id,
        chunkId,
        resumeId,
        userId,
        section: section as ResumeSection,
        chunkIndex,
        content,
        score: point.score,
        embeddingModel:
          typeof embeddingModel === "string"
            ? embeddingModel
            : null,
      };
    });
  } catch (error) {
    if (error instanceof AppError) {
      throw error;
    }

    console.error("Qdrant search error:", error);

    throw new AppError(
      "ไม่สามารถค้นหาข้อมูลใน Vector Database ได้",
      502,
      "VECTOR_DATABASE_SEARCH_FAILED",
    );
  }
}