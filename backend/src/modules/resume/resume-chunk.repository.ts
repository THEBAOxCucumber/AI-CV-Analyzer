import type {
  PoolConnection,
  ResultSetHeader,
} from "mysql2/promise";

import { database } from "../../config/database.js";
import type {
  CreateResumeChunkInput,
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
