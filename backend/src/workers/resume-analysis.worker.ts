import {
  UnrecoverableError,
  Worker,
} from "bullmq";

import { env } from "../config/env.js";

import {
  createRedisConnection,
} from "../config/redis.js";

import {
  markAnalysisRunFailed,
} from "../modules/analysis/resume-analysis-run.repository.js";

import {
  processResumeAnalysis,
} from "../modules/analysis/resume-analysis-processor.service.js";

import {
  isRetryableGeminiError,
} from "../modules/analysis/gemini-retry.util.js";

import type {
  ResumeAnalysisJobData,
} from "../modules/analysis/resume-analysis-queue.types.js";

const workerRedisConnection =
  createRedisConnection();

export const resumeAnalysisWorker =
  new Worker<ResumeAnalysisJobData>(
    env.analysisQueue.name,

    async (job) => {
      console.log(
        "Processing resume analysis job:",
        {
          jobId:
            job.id,

          analysisRunId:
            job.data.analysisRunId,

          attempt:
            job.attemptsMade + 1,
        },
      );

      try {
        await processResumeAnalysis(
          job.data,
        );
      } catch (error) {
        /*
         * เฉพาะ Gemini 429 / 503
         * ให้ BullMQ retry
         */
        if (
          isRetryableGeminiError(
            error,
          )
        ) {
          console.warn(
            "Retryable Gemini error:",
            {
              jobId:
                job.id,

              attempt:
                job.attemptsMade + 1,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            },
          );

          throw error;
        }

        /*
         * Error อื่นทั้งหมด
         * ห้าม retry
         */
        console.error(
          "Non-retryable analysis error:",
          {
            jobId:
              job.id,

            error:
              error instanceof Error
                ? error.message
                : String(error),
          },
        );

        throw new UnrecoverableError(
          error instanceof Error
            ? error.message
            : "Resume analysis failed",
        );
      }
    },

    {
      connection:
        workerRedisConnection,

      concurrency:
        2,
    },
  );

resumeAnalysisWorker.on(
  "completed",
  (job) => {
    console.log(
      "Analysis completed:",
      job.id,
    );
  },
);

resumeAnalysisWorker.on(
  "failed",
  async (
    job,
    error,
  ) => {
    if (!job) {
      return;
    }

    const maxAttempts =
      job.opts.attempts ?? 1;

    const isUnrecoverable =
      error.name ===
      "UnrecoverableError";

    const attemptsExhausted =
      job.attemptsMade >=
      maxAttempts;

    console.error(
      "Resume analysis job failed:",
      {
        jobId: job.id,
        analysisRunId:
          job.data.analysisRunId,
        attemptsMade:
          job.attemptsMade,
        maxAttempts,
        isUnrecoverable,
        attemptsExhausted,
        error:
          error.message,
      },
    );

    /*
     * Retryable error และยังเหลือ attempt
     * ห้าม mark DB FAILED
     */
    if (
      !isUnrecoverable &&
      !attemptsExhausted
    ) {
      return;
    }

    await markAnalysisRunFailed(
      job.data.analysisRunId,

      isUnrecoverable
        ? "NON_RETRYABLE_ANALYSIS_ERROR"
        : "GEMINI_RETRY_EXHAUSTED",

      error.message,
    );
  },
);

resumeAnalysisWorker.on(
  "ready",
  () => {
    console.log(
      "Resume analysis worker ready",
    );
  },
);

resumeAnalysisWorker.on(
  "active",
  (job) => {
    console.log(
      "Resume analysis job active:",
      {
        jobId: job.id,
        analysisRunId:
          job.data.analysisRunId,
      },
    );
  },
);

resumeAnalysisWorker.on(
  "error",
  (error) => {
    console.error(
      "Resume analysis worker error:",
      error,
    );
  },
);