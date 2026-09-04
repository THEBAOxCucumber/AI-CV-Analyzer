import { z } from "zod";

import { env } from "../../config/env.js";
import { gemini } from "../../config/gemini.js";
import { AppError } from "../../errors/app-error.js";

import {
  findCompletedChunksByResumeId,
} from "../resume/resume-chunk.repository.js";

import {
  findJobDescriptionById,
} from "../job-description/job-description.repository.js";

import {
  buildResumeAnalysisPrompt,
} from "./resume-analysis.prompt.js";

import {
  markAnalysisRunCompleted,
  markAnalysisRunProcessing,
} from "./resume-analysis-run.repository.js";

import {
  resumeAnalysisResultSchema,
} from "./resume-analysis.schema.js";

import type {
  ResumeAnalysisJobData,
} from "./resume-analysis-queue.types.js";

export async function processResumeAnalysis(
  jobData: ResumeAnalysisJobData,
): Promise<void> {
  /*
   * QUEUED / PROCESSING
   * → PROCESSING
   *
   * repository ควรเพิ่ม attempt_count ด้วย
   */
  const started =
  await markAnalysisRunProcessing(
    jobData.analysisRunId,
  );

if (!started) {
  console.log(
    "Skipping stale analysis job:",
    {
      analysisRunId:
        jobData.analysisRunId,
    },
  );

  return;
}

  /*
   * ดึง Resume chunks
   */
  const chunks =
    await findCompletedChunksByResumeId(
      jobData.resumeId,
      jobData.userId,
    );

  if (chunks.length === 0) {
    throw new AppError(
      "Resume ยังไม่มี Chunk ที่พร้อมวิเคราะห์",
      409,
      "RESUME_CHUNKS_NOT_READY",
    );
  }

  /*
   * ดึง Job Description เฉพาะกรณีที่มี
   */
  let jobDescription:
    | string
    | null = null;

  if (jobData.jobDescriptionId) {
    const job =
      await findJobDescriptionById(
        jobData.jobDescriptionId,
        jobData.userId,
      );

    if (!job) {
      throw new AppError(
        "ไม่พบ Job Description",
        404,
        "JOB_DESCRIPTION_NOT_FOUND",
      );
    }

    jobDescription =
      job.description;
  }

  /*
   * สร้าง Prompt
   */
  const prompt =
    buildResumeAnalysisPrompt(
      {
        chunks,
        jobDescription,
        analysisType:
          jobData.analysisType,
      },
      jobData.promptVersion,
    );

  /*
   * เรียก Gemini
   *
   * สำคัญ:
   * อย่าแปลง error เป็น AppError ตรงนี้
   * เพราะ Worker ต้องเห็น original status
   * เช่น 429 และ 503
   */
  let response;

  try {
    response =
      await gemini.models.generateContent({
        model:
          env.gemini.generationModel,

        contents:
          prompt,

        config: {
          temperature: 0.1,

          maxOutputTokens:
            2500,

          responseMimeType:
            "application/json",

          responseJsonSchema:
            z.toJSONSchema(
              resumeAnalysisResultSchema,
              {
                target:
                  "draft-07",
              },
            ),
        },
      });
  } catch (error) {
    console.error(
      "Gemini analysis request failed:",
      error,
    );

    /*
     * ส่ง original error ไป Worker
     *
     * Worker จะเป็นคนตัดสิน:
     * 429 / 503 → retry
     * อื่น ๆ → fail ทันที
     */
    throw error;
  }

  /*
   * อ่าน response text
   */
  const responseText =
    response.text?.trim();

  if (!responseText) {
    throw new AppError(
      "Gemini ไม่ได้ส่งผลวิเคราะห์กลับมา",
      502,
      "GEMINI_EMPTY_ANALYSIS_RESPONSE",
    );
  }

  /*
   * Parse JSON
   */
  let rawResult: unknown;

  try {
    rawResult =
      JSON.parse(responseText);
  } catch {
    throw new AppError(
      "Gemini ส่งผลลัพธ์ที่ไม่ใช่ JSON",
      502,
      "GEMINI_INVALID_JSON_RESPONSE",
      {
        responsePreview:
          responseText.slice(
            0,
            500,
          ),
      },
    );
  }

  /*
   * Validate ด้วย Zod
   */
  const parsed =
    resumeAnalysisResultSchema.safeParse(
      rawResult,
    );

  if (!parsed.success) {
    throw new AppError(
      "รูปแบบผลวิเคราะห์จาก Gemini ไม่ถูกต้อง",
      502,
      "GEMINI_INVALID_ANALYSIS_RESPONSE",
      parsed.error.flatten(),
    );
  }

  /*
   * Gemini + JSON + Zod ผ่านหมดแล้ว
   * จึง mark COMPLETED
   */
  await markAnalysisRunCompleted(
    jobData.analysisRunId,
    parsed.data,
    env.gemini.generationModel,
  );
}