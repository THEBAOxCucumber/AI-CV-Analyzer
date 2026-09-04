import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { database } from "../../config/database.js";

import type {
  CreateAnalysisRunInput,
  ResumeAnalysisResult,
  ResumeAnalysisRunRecord,
} from "./resume-analysis-run.types.js";

interface AnalysisRunRow
  extends RowDataPacket {
  id: number;
  resume_id: number;
  user_id: number;
  job_description_id: number | null;
  analysis_type:
  | "BASE"
  | "JOB_MATCH"
  | "COMBINED";
  status:
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";
  base_resume_score: number | null;
  job_match_score: number | null;
  prompt_version: string;
  model: string | null;
  attempt_count: number;
  error_code: string | null;
  error_message: string | null;
  created_at: Date;
  updated_at: Date;
}

function mapAnalysisRun(
  row: AnalysisRunRow,
): ResumeAnalysisRunRecord {
  return {
    id: row.id,
    resumeId: row.resume_id,
    userId: row.user_id,
    jobDescriptionId:
      row.job_description_id,
    analysisType: row.analysis_type,
    status: row.status,
    baseResumeScore:
      row.base_resume_score,
    jobMatchScore:
      row.job_match_score,
    promptVersion: row.prompt_version,
    model: row.model,
    attemptCount: row.attempt_count,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

export async function createAnalysisRun(
  input: CreateAnalysisRunInput,
): Promise<ResumeAnalysisRunRecord> {
  const [result] =
    await database.execute<ResultSetHeader>(
      `
        INSERT INTO resume_analysis_runs (
          resume_id,
          user_id,
          job_description_id,
          analysis_type,
          status,
          prompt_version,
          queued_at
        )
        VALUES (?, ?, ?, ?, 'QUEUED', ?, NOW())
      `,
      [
        input.resumeId,
        input.userId,
        input.jobDescriptionId ?? null,
        input.analysisType,
        input.promptVersion,
      ],
    );

  const analysis =
    await findAnalysisRunById(
      result.insertId,
      input.userId,
    );

  if (!analysis) {
    throw new Error(
      "Analysis run was not found after creation",
    );
  }

  return analysis;
}

export async function findAnalysisRunById(
  analysisRunId: number,
  userId: number,
): Promise<ResumeAnalysisRunRecord | null> {
  const [rows] = await database.execute<
    AnalysisRunRow[]
  >(
    `
      SELECT
        id,
        resume_id,
        user_id,
        job_description_id,
        analysis_type,
        status,
        base_resume_score,
        job_match_score,
        prompt_version,
        model,
        attempt_count,
        error_code,
        error_message,
        created_at,
        updated_at
      FROM resume_analysis_runs
      WHERE id = ?
        AND user_id = ?
      LIMIT 1
    `,
    [analysisRunId, userId],
  );

  const row = rows[0];

  return row
    ? mapAnalysisRun(row)
    : null;
}

export async function findAnalysisHistory(
  resumeId: number,
  userId: number,
  limit: number,
): Promise<ResumeAnalysisRunRecord[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(
      100,
      Math.max(1, Math.floor(limit)),
    )
    : 20;

  const [rows] = await database.execute<
    AnalysisRunRow[]
  >(
    `
      SELECT
        id,
        resume_id,
        user_id,
        job_description_id,
        analysis_type,
        status,
        base_resume_score,
        job_match_score,
        prompt_version,
        model,
        attempt_count,
        error_code,
        error_message,
        created_at,
        updated_at
      FROM resume_analysis_runs
      WHERE resume_id = ?
        AND user_id = ?
      ORDER BY created_at DESC, id DESC
      LIMIT ${safeLimit}
    `,
    [resumeId, userId],
  );

  return rows.map(mapAnalysisRun);
}

export async function markAnalysisRunProcessing(
  analysisRunId: number,
): Promise<boolean> {
  const [result] =
    await database.execute<ResultSetHeader>(
      `
        UPDATE resume_analysis_runs
        SET
          status = 'PROCESSING',
          started_at = NOW(),
          attempt_count = attempt_count + 1,
          error_code = NULL,
          error_message = NULL
        WHERE id = ?
          AND status IN ('QUEUED', 'PROCESSING')
      `,
      [analysisRunId],
    );

  return result.affectedRows === 1;
}

export async function markAnalysisRunCompleted(
  analysisRunId: number,
  result: ResumeAnalysisResult,
  model: string,
): Promise<void> {
  await database.execute<ResultSetHeader>(
    `
      UPDATE resume_analysis_runs
      SET
        status = 'COMPLETED',

        base_resume_score = ?,
        job_match_score = ?,

        contact_information_score = ?,
        professional_summary_score = ?,
        skills_score = ?,
        experience_score = ?,
        projects_score = ?,
        education_score = ?,
        readability_score = ?,

        matched_skills = ?,
        missing_skills = ?,
        keyword_matches = ?,

        summary = ?,
        strengths = ?,
        weaknesses = ?,
        recommendations = ?,

        model = ?,

        completed_at = NOW(),
        error_code = NULL,
        error_message = NULL
      WHERE id = ?
        AND status = 'PROCESSING'
    `,
    [
      result.baseResumeScore,
      result.jobMatchScore,

      result.scores.contactInformation,
      result.scores.professionalSummary,
      result.scores.skills,
      result.scores.experience,
      result.scores.projects,
      result.scores.education,
      result.scores.readability,

      JSON.stringify(
        result.jobMatch?.matchedSkills ?? [],
      ),

      JSON.stringify(
        result.jobMatch?.missingSkills ?? [],
      ),

      JSON.stringify(
        result.jobMatch?.keywordMatches ?? [],
      ),

      result.summary,
      JSON.stringify(result.strengths),
      JSON.stringify(result.weaknesses),
      JSON.stringify(
        result.recommendations,
      ),

      model,
      analysisRunId,
    ],
  );
}

export async function markAnalysisRunFailed(
  analysisRunId: number,
  errorCode: string,
  errorMessage: string,
): Promise<void> {
  await database.execute<ResultSetHeader>(
    `
            UPDATE resume_analysis_runs
      SET
        status = 'FAILED',
        error_code = ?,
        error_message = ?,
        failed_at = NOW()
      WHERE id = ?
        AND status IN (
          'QUEUED',
          'PROCESSING'
        )
    `,
    [
      errorCode,
      errorMessage,
      analysisRunId,
    ],
  );
}

export async function findActiveAnalysisRun(
  resumeId: number,
  userId: number,
): Promise<ResumeAnalysisRunRecord | null> {
  const [rows] = await database.execute<
    AnalysisRunRow[]
  >(
    `
      SELECT
        id,
        resume_id,
        user_id,
        job_description_id,
        analysis_type,
        status,
        base_resume_score,
        job_match_score,
        prompt_version,
        model,
        attempt_count,
        error_code,
        error_message,
        created_at,
        updated_at
      FROM resume_analysis_runs
      WHERE resume_id = ?
        AND user_id = ?
        AND status IN (
          'QUEUED',
          'PROCESSING'
        )
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `,
    [resumeId, userId],
  );

  const row = rows[0];

  return row
    ? mapAnalysisRun(row)
    : null;
}