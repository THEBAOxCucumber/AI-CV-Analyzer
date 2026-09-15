import {
  afterAll,
  beforeEach,
  describe,
  expect,
  it,
} from "vitest";

import type {
  ResultSetHeader,
} from "mysql2/promise";

import {
  database,
} from "../../src/config/database.js";

import {
  resumeAnalysisQueue,
} from "../../src/modules/analysis/resume-analysis.queue.js";

import {
  enqueueResumeAnalysis,
} from "../../src/modules/analysis/resume-analysis-queue.service.js";

import type {
  ResumeAnalysisRunRecord,
} from "../../src/modules/analysis/resume-analysis-run.types.js";

async function createTestUser(): Promise<number> {
  const unique =
    `${Date.now()}-${Math.random()}`;

  const [result] =
    await database.execute<ResultSetHeader>(
      `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash
        )
        VALUES (?, ?, ?, ?)
      `,
      [
        "Queue",
        "Idempotency",
        `queue-idempotency-${unique}@test.local`,
        "not-used",
      ],
    );

  return result.insertId;
}

async function createTestResume(
  userId: number,
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
          extracted_text,
          page_count,
          character_count,
          extraction_status,
          chunking_status,
          chunk_count,
          status
        )
        VALUES (
          ?,
          'queue-idempotency.pdf',
          'queue-idempotency.pdf',
          'uploads/queue-idempotency.pdf',
          'application/pdf',
          1000,
          'Node.js developer',
          1,
          17,
          'COMPLETED',
          'COMPLETED',
          1,
          'COMPLETED'
        )
      `,
      [userId],
    );

  return result.insertId;
}

async function createAnalysisRun(
  userId: number,
  resumeId: number,
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
        VALUES (
          ?,
          ?,
          NULL,
          'BASE',
          'QUEUED',
          'resume-analysis-v2.0.0',
          NOW()
        )
      `,
      [
        resumeId,
        userId,
      ],
    );

  return {
    id: result.insertId,
    resumeId,
    userId,
    jobDescriptionId: null,
    analysisType: "BASE",
    status: "QUEUED",
    baseResumeScore: null,
    jobMatchScore: null,
    promptVersion:
      "resume-analysis-v2.0.0",
    model: null,
    attemptCount: 0,
    errorCode: null,
    errorMessage: null,
    createdAt: new Date(),
    updatedAt: new Date(),
  };
}

describe(
  "resume analysis queue idempotency",
  () => {
    beforeEach(async () => {
      await resumeAnalysisQueue.drain(
        true,
      );
    });

    afterAll(async () => {
      await resumeAnalysisQueue.drain(
        true,
      );
    });

    it(
      "does not create a duplicate job for the same analysis run",
      async () => {
        const userId =
          await createTestUser();

        const resumeId =
          await createTestResume(
            userId,
          );

        const analysisRun =
          await createAnalysisRun(
            userId,
            resumeId,
          );

        await enqueueResumeAnalysis(
          analysisRun,
        );

        await enqueueResumeAnalysis(
          analysisRun,
        );

        const jobId =
          `analysis-${analysisRun.id}`;

        const job =
          await resumeAnalysisQueue.getJob(
            jobId,
          );

        expect(job).toBeTruthy();

        const jobs =
          await resumeAnalysisQueue.getJobs([
            "waiting",
            "delayed",
            "active",
            "completed",
            "failed",
          ]);

        const matchingJobs =
          jobs.filter(
            (item) =>
              item.id === jobId,
          );

        expect(
          matchingJobs,
        ).toHaveLength(1);
      },
    );
  },
);