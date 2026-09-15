import { env } from "../../config/env.js";

import { AppError } from "../../errors/app-error.js";

import {
  findJobDescriptionById,
} from "../job-description/job-description.repository.js";

import {
  findResumeById,
} from "../resume/resume.repository.js";

import {
  enforceAnalysisRateLimit,
} from "./analysis-rate-limit.service.js";

import {
  database,
} from "../../config/database.js";

import {
  createAnalysisOutboxEvent,
} from "./analysis-outbox.repository.js";

import {
  createAnalysisRun,
  findActiveAnalysisRun,
  findAnalysisHistory,
  findAnalysisRunById,
  markAnalysisRunFailed,
} from "./resume-analysis-run.repository.js";

import type {
  ResumeAnalysisRunRecord,
  ResumeAnalysisType,
} from "./resume-analysis-run.types.js";

interface StartAnalysisRunInput {
  resumeId: number;
  userId: number;
  analysisType: ResumeAnalysisType;
  jobDescriptionId?: number;
}

export async function startAnalysisRun(
  input: StartAnalysisRunInput,
): Promise<ResumeAnalysisRunRecord> {
  /*
   * 1. ตรวจ Resume + ownership
   */
  const resume =
    await findResumeById(
      input.resumeId,
      input.userId,
    );

  if (!resume) {
    throw new AppError(
      "ไม่พบ Resume",
      404,
      "RESUME_NOT_FOUND",
    );
  }

  /*
   * 2. Resume ต้องผ่าน Chunking แล้ว
   */
  if (
    resume.chunking_status !==
    "COMPLETED"
  ) {
    throw new AppError(
      "Resume ยังแบ่ง Chunk ไม่สำเร็จ",
      409,
      "RESUME_CHUNKS_NOT_READY",
    );
  }

  /*
   * 3. ตรวจ Job Description
   */
  let jobDescriptionId:
    | number
    | null = null;

  if (
    input.analysisType ===
    "JOB_MATCH" ||
    input.analysisType ===
    "COMBINED"
  ) {
    if (!input.jobDescriptionId) {
      throw new AppError(
        "กรุณาระบุ Job Description",
        400,
        "JOB_DESCRIPTION_REQUIRED",
      );
    }

    const jobDescription =
      await findJobDescriptionById(
        input.jobDescriptionId,
        input.userId,
      );

    if (!jobDescription) {
      throw new AppError(
        "ไม่พบ Job Description",
        404,
        "JOB_DESCRIPTION_NOT_FOUND",
      );
    }

    jobDescriptionId =
      jobDescription.id;
  }
  const activeAnalysis =
    await findActiveAnalysisRun(
      input.resumeId,
      input.userId,
    );

  if (activeAnalysis) {
    throw new AppError(
      "Resume นี้มีงานวิเคราะห์ที่กำลังดำเนินการอยู่",
      409,
      "ANALYSIS_ALREADY_IN_PROGRESS",
      {
        analysisRunId:
          activeAnalysis.id,
        status:
          activeAnalysis.status,
      },
    );
  }

  /*
   * 4. Rate Limit
   *
   * ต้องตรวจ BEFORE createAnalysisRun()
   * เพื่อไม่ให้เกิด record ใน MySQL
   * เมื่อ user ถูก rate limit
   */
  await enforceAnalysisRateLimit(
    input.userId,
  );

  /*
   * 5. สร้าง Analysis Run
   */
  const connection =
    await database.getConnection();

  let analysisRun:
    ResumeAnalysisRunRecord;

  try {
    await connection.beginTransaction();

    analysisRun =
      await createAnalysisRun(
        {
          resumeId: input.resumeId,
          userId: input.userId,
          analysisType:
            input.analysisType,
          jobDescriptionId,
          promptVersion:
            env.resumeAnalysis.promptVersion,
        },
        connection,
      );

    await createAnalysisOutboxEvent(
      analysisRun.id,
      connection,
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }

  return analysisRun;
}

export async function getResumeAnalysisHistory(
  resumeId: number,
  userId: number,
  limit = 20,
): Promise<ResumeAnalysisRunRecord[]> {
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

  return findAnalysisHistory(
    resumeId,
    userId,
    limit,
  );
}

export async function getAnalysisRun(
  analysisRunId: number,
  userId: number,
): Promise<ResumeAnalysisRunRecord> {
  const analysisRun =
    await findAnalysisRunById(
      analysisRunId,
      userId,
    );

  if (!analysisRun) {
    throw new AppError(
      "ไม่พบ Analysis",
      404,
      "ANALYSIS_RUN_NOT_FOUND",
    );
  }

  return analysisRun;
}