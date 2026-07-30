import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { database } from "../../config/database.js";

interface JobDescriptionRow
  extends RowDataPacket {
  id: number;
  user_id: number;
  title: string | null;
  company: string | null;
  description: string;
  created_at: Date;
  updated_at: Date;
}

export interface JobDescriptionRecord {
  id: number;
  userId: number;
  title: string | null;
  company: string | null;
  description: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface CreateJobDescriptionInput {
  userId: number;
  title?: string;
  company?: string;
  description: string;
}

function mapJobDescription(
  row: JobDescriptionRow,
): JobDescriptionRecord {
  return {
    id: row.id,
    userId: row.user_id,
    title: row.title,
    company: row.company,
    description: row.description,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createJobDescription(
  input: CreateJobDescriptionInput,
): Promise<JobDescriptionRecord> {
  const [result] =
    await database.execute<ResultSetHeader>(
      `
        INSERT INTO job_descriptions (
          user_id,
          title,
          company,
          description
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        input.userId,
        input.title ?? null,
        input.company ?? null,
        input.description,
      ],
    );

  const jobDescription =
    await findJobDescriptionById(
      result.insertId,
      input.userId,
    );

  if (!jobDescription) {
    throw new Error(
      "Job description was not found after creation",
    );
  }

  return jobDescription;
}

export async function findJobDescriptionById(
  id: number,
  userId: number,
): Promise<JobDescriptionRecord | null> {
  const [rows] = await database.execute<
    JobDescriptionRow[]
  >(
    `
      SELECT
        id,
        user_id,
        title,
        company,
        description,
        created_at,
        updated_at
      FROM job_descriptions
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [id, userId],
  );

  const row = rows[0];

  return row
    ? mapJobDescription(row)
    : null;
}