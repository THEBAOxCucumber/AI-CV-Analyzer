import { z } from "zod";
import { Ollama } from "ollama";

import { env } from "../../config/env.js";
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
  normalizeResumeAnalysisResult,
} from "./resume-analysis-normalizer.js";

import {
  markAnalysisRunCompleted,
  markAnalysisRunProcessing,
} from "./resume-analysis-run.repository.js";

import {
  createResumeAnalysisResultSchemaFor,
} from "./resume-analysis.schema.js";

import type {
  ResumeAnalysisJobData,
} from "./resume-analysis-queue.types.js";

/*
 * SDK ไม่รับ signal สำหรับ request แบบ non-stream
 * จึงใส่ timeout ผ่าน custom fetch
 */
const ollama = new Ollama({
  host: env.ollama.host,

  fetch: (input, init) =>
    fetch(input, {
      ...init,
      signal: AbortSignal.timeout(
        env.ollama.timeoutMs,
      ),
    }),
});

export async function processResumeAnalysis(
  jobData: ResumeAnalysisJobData,
  jobId: string,
): Promise<void> {
  /*
   * QUEUED → PROCESSING
   *
   * repository จะเพิ่ม attempt_count
   */
  const started =
    await markAnalysisRunProcessing(
      jobData.analysisRunId,
      jobId,
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
   * โหลด Resume chunks
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
   * โหลด Job Description
   * เฉพาะ JOB_MATCH / COMBINED ที่มี ID
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

    console.log(
      "Job description size:",
      {
        analysisRunId:
          jobData.analysisRunId,
        characters:
          job.description.length,
      },
    );
  }

  /*
   * ใช้ production prompt เดิม
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

  console.log(
    "Resume analysis prompt size:",
    {
      analysisRunId:
        jobData.analysisRunId,
      analysisType:
        jobData.analysisType,
      characters:
        prompt.length,
      chunks:
        chunks.length,
    },
  );

  /*
   * Schema ตามประเภท analysis
   * → JSON Schema ให้ Ollama บังคับ output
   *   (JOB_MATCH ห้ามตอบ jobMatch: null)
   */
  const resultSchema =
    createResumeAnalysisResultSchemaFor(
      jobData.analysisType,
    );

  const jsonSchema =
    z.toJSONSchema(
      resultSchema,
      {
        target: "draft-07",
      },
    );

  /*
   * เรียก Local LLM ผ่าน Ollama
   */
  let response;

  try {
    response =
      await ollama.chat({
        model:
          env.ollama.model,

        messages: [
          {
            role: "user",
            content: prompt,
          },
        ],

        stream: false,

        format:
          jsonSchema,

        options: {
          temperature: 0.1,
        },
      });
  } catch (error) {
    console.error(
      "Ollama analysis request failed:",
      {
        model:
          env.ollama.model,

        timeoutMs:
          env.ollama.timeoutMs,

        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    /*
     * ปล่อย original error ขึ้น Worker
     * เพื่อให้ Queue สามารถ retry ได้
     */
    throw error;
  }

  /*
   * อ่าน response
   */
  const responseText =
    response.message.content.trim();

  if (!responseText) {
    throw new AppError(
      "Local AI ไม่ได้ส่งผลวิเคราะห์กลับมา",
      502,
      "OLLAMA_EMPTY_ANALYSIS_RESPONSE",
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
      "Local AI ส่งผลลัพธ์ที่ไม่ใช่ JSON",
      502,
      "OLLAMA_INVALID_JSON_RESPONSE",
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
   * ให้ backend คำนวณค่าที่ deterministic
   *
   * baseResumeScore =
   *   ผลรวม section scores
   *
   * jobMatchScore =
   *   jobMatch.score หรือ null
   */
  const normalizedResult =
    normalizeResumeAnalysisResult(
      rawResult,
    );

  /*
   * Validate contract เดิมด้วย Zod
   */
  const parsed =
    resultSchema.safeParse(
      normalizedResult,
    );

  if (!parsed.success) {
    throw new AppError(
      "รูปแบบผลวิเคราะห์จาก Local AI ไม่ถูกต้อง",
      502,
      "OLLAMA_INVALID_ANALYSIS_RESPONSE",
      parsed.error.flatten(),
    );
  }

  /*
   * Ollama + JSON + Normalize + Zod
   * ผ่านทั้งหมดแล้ว
   */
  await markAnalysisRunCompleted(
    jobData.analysisRunId,
    parsed.data,
    env.ollama.model,
  );
}