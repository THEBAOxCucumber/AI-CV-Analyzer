import type {
  PoolConnection,
  ResultSetHeader,
} from "mysql2/promise";



import { database } from "../../config/database.js";
import type {
  CreateResumeChunkInput,
  PendingResumeChunk,
  ResumeChunkRow,
} from "./resume-chunk.types.js";

/*
 * ลบ Chunk เก่าของ Resume
 * ใช้เมื่อผู้ใช้สั่งสร้าง Chunk ใหม่
 */
export async function deleteChunksByResumeId(
  resumeId: number,
  connection?: PoolConnection,
): Promise<number> {
  const executor = connection ?? database;

  const [result] =
    await executor.execute<ResultSetHeader>(
      `
        DELETE FROM resume_chunks
        WHERE resume_id = ?
      `,
      [resumeId],
    );

  return result.affectedRows;
}

/*
 * บันทึก Chunk หลายรายการโดยใช้ Transaction เดียวกัน
 */
export async function createResumeChunks(
  chunks: CreateResumeChunkInput[],
  connection: PoolConnection,
): Promise<void> {
  const sql = `
    INSERT INTO resume_chunks (
      resume_id,
      user_id,
      section,
      chunk_index,
      content,
      character_count,
      embedding_status
    )
    VALUES (?, ?, ?, ?, ?, ?, 'PENDING')
  `;

  for (const chunk of chunks) {
    await connection.execute<ResultSetHeader>(
      sql,
      [
        chunk.resumeId,
        chunk.userId,
        chunk.section,
        chunk.chunkIndex,
        chunk.content,
        chunk.characterCount,
      ],
    );
  }
}

export async function findChunksByResumeId(
  resumeId: number,
  userId: number,
): Promise<ResumeChunkRow[]> {
  const [rows] =
    await database.execute<ResumeChunkRow[]>(
      `
        SELECT
          id,
          resume_id,
          user_id,
          section,
          chunk_index,
          content,
          character_count,
          embedding_status,
          vector_point_id,
          embedding_model,
          embedding_dimensions,
          embedding_error,
          embedded_at,
          created_at,
          updated_at
        FROM resume_chunks
        WHERE resume_id = ?
          AND user_id = ?
        ORDER BY chunk_index ASC
      `,
      [resumeId, userId],
    );

  return rows;
}

export async function markResumeChunkingProcessing(
  resumeId: number,
  userId: number,
  connection?: import("mysql2/promise").PoolConnection,
): Promise<boolean> {
  const executor = connection ?? database;

  const [result] =
    await executor.execute<ResultSetHeader>(
      `
        UPDATE resumes
        SET
          chunking_status = 'PROCESSING',
          chunking_error = NULL
        WHERE id = ?
          AND user_id = ?
      `,
      [resumeId, userId],
    );

  return result.affectedRows > 0;
}

export async function markResumeChunkingCompleted(
  resumeId: number,
  userId: number,
  chunkCount: number,
  connection?: import("mysql2/promise").PoolConnection,
): Promise<boolean> {
  const executor = connection ?? database;

  const [result] =
    await executor.execute<ResultSetHeader>(
      `
        UPDATE resumes
        SET
          chunking_status = 'COMPLETED',
          chunk_count = ?,
          chunking_error = NULL
        WHERE id = ?
          AND user_id = ?
      `,
      [chunkCount, resumeId, userId],
    );

  return result.affectedRows > 0;
}

export async function markResumeChunkingFailed(
  resumeId: number,
  userId: number,
  errorMessage: string,
): Promise<void> {
  await database.execute<ResultSetHeader>(
    `
      UPDATE resumes
      SET
        chunking_status = 'FAILED',
        chunking_error = ?
      WHERE id = ?
        AND user_id = ?
    `,
    [errorMessage, resumeId, userId],
  );
}

export async function findPendingChunksByResumeId(
  resumeId: number,
  userId: number,
  limit: number,
): Promise<PendingResumeChunk[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.max(1, Math.floor(limit))
    : 10;

  const [rows] = await database.execute<
    Array<
      import("mysql2").RowDataPacket &
        PendingResumeChunk
    >
  >(
    `
      SELECT
        id,
        resume_id AS resumeId,
        user_id AS userId,
        section,
        chunk_index AS chunkIndex,
        content
      FROM resume_chunks
      WHERE resume_id = ?
        AND user_id = ?
        AND embedding_status = 'PENDING'
      ORDER BY chunk_index ASC
      LIMIT ${safeLimit}
    `,
    [resumeId, userId],
  );

  return rows;
}

//เปลี่ยนสถานะเป็น PROCESSING
export async function markChunksProcessing(
  chunkIds: number[],
): Promise<void> {
  if (chunkIds.length === 0) {
    return;
  }

  const placeholders = chunkIds
    .map(() => "?")
    .join(", ");

  await database.execute<ResultSetHeader>(
    `
      UPDATE resume_chunks
      SET
        embedding_status = 'PROCESSING',
        embedding_error = NULL
      WHERE id IN (${placeholders})
        AND embedding_status = 'PENDING'
    `,
    chunkIds,
  );
}

//เปลี่ยนสถานะเป็น COMPLETED
export interface CompleteChunkEmbeddingInput {
  chunkId: number;
  vectorPointId: string;
  embeddingModel: string;
  embeddingDimensions: number;
}

//เปลี่ยนสถานะเป็น FAILED
export async function markChunkEmbeddingCompleted(
  input: CompleteChunkEmbeddingInput,
  connection?: PoolConnection,
): Promise<boolean> {
  const executor = connection ?? database;

  const [result] =
    await executor.execute<ResultSetHeader>(
      `
        UPDATE resume_chunks
        SET
          embedding_status = 'COMPLETED',
          vector_point_id = ?,
          embedding_model = ?,
          embedding_dimensions = ?,
          embedding_error = NULL,
          embedded_at = CURRENT_TIMESTAMP
        WHERE id = ?
      `,
      [
        input.vectorPointId,
        input.embeddingModel,
        input.embeddingDimensions,
        input.chunkId,
      ],
    );

  return result.affectedRows > 0;
}

export async function markChunksEmbeddingFailed(
  chunkIds: number[],
  errorMessage: string,
): Promise<void> {
  if (chunkIds.length === 0) {
    return;
  }

  const placeholders = chunkIds
    .map(() => "?")
    .join(", ");

  await database.execute<ResultSetHeader>(
    `
      UPDATE resume_chunks
      SET
        embedding_status = 'FAILED',
        embedding_error = ?
      WHERE id IN (${placeholders})
    `,
    [errorMessage, ...chunkIds],
  );
}

export async function resetProcessingChunksToPending(
  resumeId: number,
  userId: number,
): Promise<number> {
  const [result] =
    await database.execute<ResultSetHeader>(
      `
        UPDATE resume_chunks
        SET
          embedding_status = 'PENDING',
          embedding_error = NULL
        WHERE resume_id = ?
          AND user_id = ?
          AND embedding_status = 'PROCESSING'
          AND updated_at <
              DATE_SUB(NOW(), INTERVAL 10 MINUTE)
      `,
      [resumeId, userId],
    );

  return result.affectedRows;
}

export interface CompletedResumeChunk {
  id: number;
  resumeId: number;
  chunkIndex: number;
  section: string;
  content: string;
}

import type {
  RowDataPacket,
} from "mysql2";



interface CompletedResumeChunkRow
  extends RowDataPacket {
  id: number;
  resume_id: number;
  chunk_index: number;
  section: string;
  content: string;
}

export async function findCompletedChunksByResumeId(
  resumeId: number,
  userId: number,
): Promise<CompletedResumeChunk[]> {
  const [rows] = await database.execute<
    CompletedResumeChunkRow[]
  >(
    `
      SELECT
        rc.id,
        rc.resume_id,
        rc.chunk_index,
        rc.section,
        rc.content
      FROM resume_chunks AS rc
      INNER JOIN resumes AS r
        ON r.id = rc.resume_id
      WHERE rc.resume_id = ?
        AND r.user_id = ?
        AND rc.embedding_status = 'COMPLETED'
      ORDER BY rc.chunk_index ASC
    `,
    [resumeId, userId],
  );

  return rows.map((row) => ({
    id: row.id,
    resumeId: row.resume_id,
    chunkIndex: row.chunk_index,
    section: row.section,
    content: row.content,
  }));
}

