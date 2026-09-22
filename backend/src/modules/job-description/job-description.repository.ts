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
  source: string | null;
  external_job_id: string | null;
  source_url: string | null;
  location: string | null;
  employment_type: string | null;
  salary: string | null;
  posted_at: Date | null;
}

export interface JobDescriptionRecord {
  id: number;
  userId: number;
  title: string | null;
  company: string | null;
  description: string;
  createdAt: Date;
  updatedAt: Date;
  source: string | null;
  externalJobId: string | null;
  sourceUrl: string | null;
  location: string | null;
  employmentType: string | null;
  salary: string | null;
  postedAt: Date | null;
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
    source: row.source,
    externalJobId:
      row.external_job_id,
    sourceUrl:
      row.source_url,
    location:
      row.location,
    employmentType:
      row.employment_type,
    salary:
      row.salary,
    postedAt:
      row.posted_at,
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
        source,
        external_job_id,
        source_url,
        location,
        employment_type,
        salary,
        posted_at,
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

export async function findJobDescriptionByExternalId(
  userId: number,
  source: string,
  externalJobId: string,
): Promise<JobDescriptionRecord | null> {
  const [rows] =
    await database.execute<
      JobDescriptionRow[]
    >(
      `
        SELECT
          id,
          user_id,
          title,
          company,
          description,
          source,
          external_job_id,
          source_url,
          location,
          employment_type,
          salary,
          posted_at,
          created_at,
          updated_at
        FROM job_descriptions
        WHERE user_id = ?
          AND source = ?
          AND external_job_id = ?
        LIMIT 1
      `,
      [
        userId,
        source,
        externalJobId,
      ],
    );

  const row = rows[0];

  return row
    ? mapJobDescription(row)
    : null;
}

export interface CreateExternalJobDescriptionInput {
  userId: number;
  title: string;
  company?: string | null;
  description: string;

  source: string;
  externalJobId: string;
  sourceUrl: string;

  location?: string | null;
  employmentType?: string | null;
  salary?: string | null;
  postedAt?: Date | null;
}

export async function createExternalJobDescription(
  input: CreateExternalJobDescriptionInput,
): Promise<JobDescriptionRecord> {
  const [result] =
    await database.execute<ResultSetHeader>(
      `
        INSERT INTO job_descriptions (
          user_id,
          title,
          company,
          description,
          source,
          external_job_id,
          source_url,
          location,
          employment_type,
          salary,
          posted_at
        )
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `,
      [
        input.userId,
        input.title,
        input.company ?? null,
        input.description,
        input.source,
        input.externalJobId,
        input.sourceUrl,
        input.location ?? null,
        input.employmentType ?? null,
        input.salary ?? null,
        input.postedAt ?? null,
      ],
    );

  const jobDescription =
    await findJobDescriptionById(
      result.insertId,
      input.userId,
    );

  if (!jobDescription) {
    throw new Error(
      "External job description was not found after creation",
    );
  }

  return jobDescription;
}