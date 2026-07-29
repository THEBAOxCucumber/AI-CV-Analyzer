import { AppError } from "../../errors/app-error.js";
import { database } from "../../config/database.js";
import {
  createResumeChunks,
  deleteChunksByResumeId,
  findChunksByResumeId,
} from "./resume-chunk.repository.js";
import {
  findResumeById,
  markResumeChunkingCompleted,
  markResumeChunkingFailed,
  markResumeChunkingProcessing,
} from "./resume.repository.js";
import type {
  CreateResumeChunkInput,
  ResumeChunk,
  ResumeChunkRow,
} from "./resume-chunk.types.js";

import {
  generateResumeChunks,
} from "./resume-chunk.util.js";

function mapResumeChunk(
  row: ResumeChunkRow,
): ResumeChunk {
  return {
    id: row.id,
    resumeId: row.resume_id,
    userId: row.user_id,
    section: row.section,
    chunkIndex: row.chunk_index,
    content: row.content,
    characterCount: row.character_count,
    embeddingStatus: row.embedding_status,
    vectorPointId: row.vector_point_id,
    embeddingModel: row.embedding_model,
    embeddingDimensions: row.embedding_dimensions,
    embeddingError: row.embedding_error,
    embeddedAt: row.embedded_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function chunkResumeText(
  resumeId: number,
  userId: number,
): Promise<ResumeChunk[]> {
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
    resume.extraction_status !== "COMPLETED" &&
    resume.extraction_status !== "EMPTY"
  ) {
    throw new AppError(
      "Resume ยังดึงข้อความไม่สำเร็จ",
      409,
      "RESUME_TEXT_NOT_READY",
    );
  }

  if (!resume.extracted_text?.trim()) {
    throw new AppError(
      "Resume ไม่มีข้อความสำหรับแบ่ง Chunk",
      422,
      "RESUME_TEXT_EMPTY",
    );
  }

  const generatedChunks = generateResumeChunks(
    resume.extracted_text,
    {
      maxCharacters: 1_200,
      overlapCharacters: 200,
    },
  );

  if (generatedChunks.length === 0) {
    throw new AppError(
      "ไม่สามารถแบ่งข้อความ Resume ได้",
      422,
      "RESUME_CHUNKING_EMPTY",
    );
  }

  const chunksToCreate: CreateResumeChunkInput[] =
    generatedChunks.map((chunk) => ({
      resumeId,
      userId,
      section: chunk.section,
      chunkIndex: chunk.chunkIndex,
      content: chunk.content,
      characterCount: chunk.characterCount,
    }));

  const connection =
    await database.getConnection();

  try {
    await connection.beginTransaction();

    const processingUpdated =
      await markResumeChunkingProcessing(
        resumeId,
        userId,
        connection,
      );

    if (!processingUpdated) {
      throw new AppError(
        "ไม่สามารถอัปเดตสถานะ Resume ได้",
        500,
        "RESUME_CHUNKING_STATUS_FAILED",
      );
    }

    /*
     * สร้างใหม่แบบ idempotent:
     * ลบ Chunk เดิมก่อน แล้วค่อย Insert ใหม่
     */
    await deleteChunksByResumeId(
      resumeId,
      connection,
    );

    await createResumeChunks(
      chunksToCreate,
      connection,
    );

    const completedUpdated =
      await markResumeChunkingCompleted(
        resumeId,
        userId,
        chunksToCreate.length,
        connection,
      );

    if (!completedUpdated) {
      throw new AppError(
        "ไม่สามารถบันทึกผลการแบ่ง Chunk ได้",
        500,
        "RESUME_CHUNKING_UPDATE_FAILED",
      );
    }

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถแบ่งข้อความ Resume ได้";

    await markResumeChunkingFailed(
      resumeId,
      userId,
      message,
    ).catch((statusError) => {
      console.error(
        "Unable to mark chunking as failed:",
        statusError,
      );
    });

    throw error;
  } finally {
    connection.release();
  }

  const savedChunks =
    await findChunksByResumeId(
      resumeId,
      userId,
    );

  return savedChunks.map(mapResumeChunk);
}

export async function getResumeChunks(
  resumeId: number,
  userId: number,
): Promise<ResumeChunk[]> {
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

  const chunks =
    await findChunksByResumeId(
      resumeId,
      userId,
    );

  return chunks.map(mapResumeChunk);
}