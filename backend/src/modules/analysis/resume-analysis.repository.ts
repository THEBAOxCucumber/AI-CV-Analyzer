import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";

import { database } from "../../config/database.js";
import type {
  ResumeAnalysisRecord,
  ResumeAnalysisScores,
} from "./resume-analysis.types.js";
import type {
  ResumeAnalysisResult,
} from "./resume-analysis.schema.js";

interface ResumeAnalysisRow
  extends RowDataPacket {
  id: number;
  resume_id: number;
  user_id: number;
  status:
    | "PENDING"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED";

  overall_score: number | null;

  contact_information_score:
    | number
    | null;

  professional_summary_score:
    | number
    | null;

  skills_score: number | null;
  experience_score: number | null;
  projects_score: number | null;
  education_score: number | null;
  readability_score: number | null;
  job_relevance_score: number | null;

  summary: string | null;

  strengths: string | null;
  weaknesses: string | null;
  recommendations: string | null;

  model: string | null;
  prompt_version: string | null;
  error_message: string | null;

  analyzed_at: Date | null;
  created_at: Date;
  updated_at: Date;
}

function parseStringArray(
  value: unknown,
): string[] {
  if (
    Array.isArray(value) &&
    value.every(
      (item) => typeof item === "string",
    )
  ) {
    return value;
  }

  if (typeof value !== "string") {
    return [];
  }

  try {
    const parsed: unknown = JSON.parse(value);

    return Array.isArray(parsed) &&
      parsed.every(
        (item) => typeof item === "string",
      )
      ? parsed
      : [];
  } catch {
    return [];
  }
}

function mapScores(
  row: ResumeAnalysisRow,
): ResumeAnalysisScores | null {
  const values = [
    row.contact_information_score,
    row.professional_summary_score,
    row.skills_score,
    row.experience_score,
    row.projects_score,
    row.education_score,
    row.readability_score,
    row.job_relevance_score,
  ];

  if (values.some((value) => value === null)) {
    return null;
  }

  return {
    contactInformation:
      row.contact_information_score!,
    professionalSummary:
      row.professional_summary_score!,
    skills: row.skills_score!,
    experience: row.experience_score!,
    projects: row.projects_score!,
    education: row.education_score!,
    readability: row.readability_score!,
    jobRelevance:
      row.job_relevance_score!,
  };
}

function mapAnalysisRow(
  row: ResumeAnalysisRow,
): ResumeAnalysisRecord {
  return {
    id: row.id,
    resumeId: row.resume_id,
    userId: row.user_id,
    status: row.status,
    overallScore: row.overall_score,
    scores: mapScores(row),
    summary: row.summary,
    strengths: parseStringArray(
      row.strengths,
    ),
    weaknesses: parseStringArray(
      row.weaknesses,
    ),
    recommendations: parseStringArray(
      row.recommendations,
    ),
    model: row.model,
    promptVersion: row.prompt_version,
    errorMessage: row.error_message,
    analyzedAt: row.analyzed_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function findResumeAnalysis(
  resumeId: number,
  userId: number,
): Promise<ResumeAnalysisRecord | null> {
  const [rows] = await database.execute<
    ResumeAnalysisRow[]
  >(
    `
      SELECT *
      FROM resume_analyses
      WHERE resume_id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [resumeId, userId],
  );

  const row = rows[0];

  return row ? mapAnalysisRow(row) : null;
}

export async function upsertAnalysisProcessing(
  resumeId: number,
  userId: number,
): Promise<void> {
  await database.execute<ResultSetHeader>(
    `
      INSERT INTO resume_analyses (
        resume_id,
        user_id,
        status,
        error_message
      )
      VALUES (?, ?, 'PROCESSING', NULL)
      ON DUPLICATE KEY UPDATE
        status = 'PROCESSING',
        error_message = NULL,
        updated_at = CURRENT_TIMESTAMP
    `,
    [resumeId, userId],
  );
}

export async function markAnalysisCompleted(
  resumeId: number,
  userId: number,
  result: ResumeAnalysisResult,
  model: string,
  promptVersion: string,
): Promise<void> {
  await database.execute<ResultSetHeader>(
    `
      UPDATE resume_analyses
      SET
        status = 'COMPLETED',

        overall_score = ?,

        contact_information_score = ?,
        professional_summary_score = ?,
        skills_score = ?,
        experience_score = ?,
        projects_score = ?,
        education_score = ?,
        readability_score = ?,
        job_relevance_score = ?,

        summary = ?,
        strengths = ?,
        weaknesses = ?,
        recommendations = ?,

        model = ?,
        prompt_version = ?,

        error_message = NULL,
        analyzed_at = CURRENT_TIMESTAMP
      WHERE resume_id = ?
        AND user_id = ?
    `,
    [
      result.baseResumeScore,

      result.scores.contactInformation,
      result.scores.professionalSummary,
      result.scores.skills,
      result.scores.experience,
      result.scores.projects,
      result.scores.education,
      result.scores.readability,

      result.jobMatchScore,

      result.summary,
      JSON.stringify(result.strengths),
      JSON.stringify(result.weaknesses),
      JSON.stringify(
        result.recommendations,
      ),

      model,
      promptVersion,

      resumeId,
      userId,
    ],
  );
}

export async function markAnalysisFailed(
  resumeId: number,
  userId: number,
  errorMessage: string,
): Promise<void> {
  await database.execute<ResultSetHeader>(
    `
      UPDATE resume_analyses
      SET
        status = 'FAILED',
        error_message = ?
      WHERE resume_id = ?
        AND user_id = ?
    `,
    [
      errorMessage.slice(0, 5_000),
      resumeId,
      userId,
    ],
  );
}