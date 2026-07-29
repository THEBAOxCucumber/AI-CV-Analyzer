import crypto from "node:crypto";

import { database } from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import {
  findResumeById,
} from "../resume/resume.repository.js";
import {
  findPendingChunksByResumeId,
  markChunkEmbeddingCompleted,
  markChunksEmbeddingFailed,
  markChunksProcessing,
  resetProcessingChunksToPending,
} from "../resume/resume-chunk.repository.js";
import type {
  PendingResumeChunk,
} from "../resume/resume-chunk.types.js";
import {
  createDocumentEmbeddings,
} from "./embedding-provider.service.js";
import {
  ensureResumeVectorCollection,
  upsertResumeVectors,
} from "./vector-store.service.js";

export interface EmbedResumeResult {
  resumeId: number;
  processedCount: number;
  remainingPendingCount: number;
}

function createVectorPointId(): string {
  return crypto.randomUUID();
}

async function processEmbeddingBatch(
  chunks: PendingResumeChunk[],
): Promise<void> {
  const chunkIds = chunks.map(
    (chunk) => chunk.id,
  );

  await markChunksProcessing(chunkIds);

  try {
    const embeddingResults =
  await createDocumentEmbeddings(
    chunks.map((chunk) => chunk.content),
  );
    if (
      embeddingResults.length !== chunks.length
    ) {
      throw new AppError(
        "จำนวน Embedding ไม่ตรงกับจำนวน Chunk",
        500,
        "EMBEDDING_RESULT_COUNT_MISMATCH",
      );
    }

    const points = chunks.map(
      (chunk, index) => {
        const embedding =
          embeddingResults[index];

        if (!embedding) {
          throw new AppError(
            "ไม่พบผล Embedding ของ Chunk",
            500,
            "EMBEDDING_RESULT_MISSING",
          );
        }

        const vectorPointId =
          createVectorPointId();

        return {
          chunk,
          vectorPointId,
          embedding,
          point: {
            id: vectorPointId,
            vector: embedding.embedding,
            payload: {
              chunkId: chunk.id,
              resumeId: chunk.resumeId,
              userId: chunk.userId,
              section: chunk.section,
              chunkIndex: chunk.chunkIndex,
              content: chunk.content,
              embeddingModel:
                embedding.model,
            },
          },
        };
      },
    );

    /*
     * บันทึก Vector ลง Qdrant ก่อน
     */
    await upsertResumeVectors(
      points.map((item) => item.point),
    );

    /*
     * เมื่อ Qdrant สำเร็จ จึงอัปเดต Reference ใน MySQL
     */
    const connection =
      await database.getConnection();

    try {
      await connection.beginTransaction();

      for (const item of points) {
        const updated =
          await markChunkEmbeddingCompleted(
            {
              chunkId: item.chunk.id,
              vectorPointId:
                item.vectorPointId,
              embeddingModel:
                item.embedding.model,
              embeddingDimensions:
                item.embedding.dimensions,
            },
            connection,
          );

        if (!updated) {
          throw new AppError(
            `ไม่สามารถอัปเดต Chunk ID ${item.chunk.id}`,
            500,
            "CHUNK_EMBEDDING_UPDATE_FAILED",
          );
        }
      }

      await connection.commit();
    } catch (error) {
      await connection.rollback();
      throw error;
    } finally {
      connection.release();
    }
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถสร้าง Embedding ได้";

    await markChunksEmbeddingFailed(
      chunkIds,
      message,
    ).catch((statusError) => {
      console.error(
        "Unable to mark chunks failed:",
        statusError,
      );
    });

    throw error;
  }
}

export async function embedPendingResumeChunks(
  resumeId: number,
  userId: number,
): Promise<EmbedResumeResult> {
  const resume = await findResumeById(
    resumeId,
    userId,
  );

  if (!resume) {
    throw new AppError(
      "ไม่พบ Resume",
      404,
      "RESUME_NOT_FOUND",
    );
  }

  if (
    resume.chunking_status !== "COMPLETED"
  ) {
    throw new AppError(
      "Resume ยังแบ่ง Chunk ไม่สำเร็จ",
      409,
      "RESUME_CHUNKS_NOT_READY",
    );
  }

  await ensureResumeVectorCollection();

  let processedCount = 0;

  while (true) {
    const pendingChunks =
      await findPendingChunksByResumeId(
        resumeId,
        userId,
        env.embedding.batchSize,
      );

    if (pendingChunks.length === 0) {
      break;
    }

    await processEmbeddingBatch(
      pendingChunks,
    );

    processedCount += pendingChunks.length;
  }

  const remainingChunks =
    await findPendingChunksByResumeId(
      resumeId,
      userId,
      1,
    );

  return {
    resumeId,
    processedCount,
    remainingPendingCount:
      remainingChunks.length,
  };
}

