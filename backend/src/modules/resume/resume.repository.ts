import type { ResultSetHeader } from "mysql2";

import { database } from "../../config/database.js";
import type {
    CreateResumeInput,
    ExtractionStatus,
    ResumeRow,
} from "./resume.types.js";

export async function createResumeRecord(
    input: CreateResumeInput,
): Promise<number> {
    const [result] =
        await database.execute<ResultSetHeader>(
            `
        INSERT INTO resumes (
          user_id,
          original_name,
          stored_name,
          file_path,
          mime_type,
          file_size,
          status
        )
        VALUES (?, ?, ?, ?, ?, ?, 'UPLOADED')
      `,
            [
                input.userId,
                input.originalName,
                input.storedName,
                input.filePath,
                input.mimeType,
                input.fileSize,
            ],
        );

    return result.insertId;
}

export async function findResumeById(
    resumeId: number,
    userId: number,
): Promise<ResumeRow | null> {
    const [rows] = await database.execute<ResumeRow[]>(
        `
      SELECT
        id,
        user_id,
        original_name,
        stored_name,
        file_path,
        mime_type,
        file_size,
        extracted_text,
        page_count,
        character_count,
        extraction_status,
        extraction_error,
        chunking_status,
        chunk_count,
        chunking_error,
        status,
        created_at,
        updated_at
        FROM resumes
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
        [resumeId, userId],
    );

    return rows[0] ?? null;
}

export async function findResumesByUserId(
    userId: number,
): Promise<ResumeRow[]> {
    const [rows] = await database.execute<ResumeRow[]>(
        `
      SELECT
        id,
        user_id,
        original_name,
        stored_name,
        file_path,
        mime_type,
        file_size,
        extracted_text,
        page_count,
        character_count,
        extraction_status,
        extraction_error,
        chunking_status,
        chunk_count,
        chunking_error,
        status,
        created_at,
        updated_at
        FROM resumes
      WHERE user_id = ?
      ORDER BY created_at DESC
    `,
        [userId],
    );

    return rows;
}

export async function updateResumeExtraction(
    resumeId: number,
    userId: number,
    extractedText: string,
    pageCount: number,
    characterCount: number,
    extractionStatus: ExtractionStatus,
): Promise<boolean> {
    const [result] =
        await database.execute<ResultSetHeader>(
            `
        UPDATE resumes
        SET
          extracted_text = ?,
          page_count = ?,
          character_count = ?,
          extraction_status = ?,
          extraction_error = NULL,
          status = 'COMPLETED'
        WHERE id = ?
          AND user_id = ?
      `,
            [
                extractedText,
                pageCount,
                characterCount,
                extractionStatus,
                resumeId,
                userId,
            ],
        );

    return result.affectedRows > 0;
}

export async function markResumeExtractionFailed(
    resumeId: number,
    userId: number,
    errorMessage: string,
): Promise<void> {
    await database.execute<ResultSetHeader>(
        `
      UPDATE resumes
      SET
        extraction_status = 'FAILED',
        extraction_error = ?,
        status = 'FAILED'
      WHERE id = ?
        AND user_id = ?
    `,
        [errorMessage, resumeId, userId],
    );
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

