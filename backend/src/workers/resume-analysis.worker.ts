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
  getRetryableLlmReason,
  type RetryableLlmReason,
} from "../modules/analysis/llm-retry.util.js";

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

      const startedAt = Date.now()

      try {
        await processResumeAnalysis(
          job.data,
          String(job.id),
        );
        console.log(
          "Resume analysis attempt completed:",
          {
            jobId: job.id,
            analysisRunId:
              job.data.analysisRunId,
            attempt:
              job.attemptsMade + 1,
            durationMs:
              Date.now() - startedAt,
          },
        );
      } catch (error) {
        /*
         * เฉพาะ LLM ติดต่อไม่ได้ / 5xx / timeout
         * ให้ BullMQ retry
         */
        const retryableReason =
          getRetryableLlmReason(
            error,
          );

        if (retryableReason) {
          console.warn(
            "Retryable LLM error:",
            {
              jobId:
                job.id,

              attempt:
                job.attemptsMade + 1,

              durationMs:
                Date.now() - startedAt,

              reason:
                retryableReason,

              error:
                error instanceof Error
                  ? error.message
                  : String(error),
            },
          );

          const retryError =
            new Error(
              error instanceof Error
                ? error.message
                : "LLM request failed",
            );

          retryError.name =
            `LlmRetryableError:${retryableReason}`;

          throw retryError;
        }

        /*
         * Error อื่นทั้งหมด
         * ห้าม retry
         */
        console.error(
          "Non-retryable analysis error:",
          {
            jobId: job.id,
            analysisRunId:
              job.data.analysisRunId,
            attempt:
              job.attemptsMade + 1,

            durationMs:
              Date.now() - startedAt,

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

function getRetryableLlmReasonFromName(
  error: Error,
): RetryableLlmReason | null {
  const match =
    /^LlmRetryableError:(UNAVAILABLE|TIMEOUT)$/.exec(
      error.name,
    );

  return match
    ? match[1] as RetryableLlmReason
    : null;
}

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

    const retryableReason =
      getRetryableLlmReasonFromName(
        error,
      );

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

    let errorCode =
  "ANALYSIS_RETRY_EXHAUSTED";

let errorMessage =
  "ไม่สามารถวิเคราะห์ Resume ได้ กรุณาลองใหม่อีกครั้ง";

if (retryableReason === "UNAVAILABLE") {
  errorCode =
    "LLM_UNAVAILABLE";

  errorMessage =
    "ระบบ AI ไม่พร้อมให้บริการชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง";
} else if (retryableReason === "TIMEOUT") {
  errorCode =
    "LLM_TIMEOUT";

  errorMessage =
    "ระบบ AI ใช้เวลาวิเคราะห์นานเกินกำหนด กรุณาลองใหม่อีกครั้ง";
}

if (isUnrecoverable) {
  errorCode =
    "NON_RETRYABLE_ANALYSIS_ERROR";

  errorMessage =
    "ไม่สามารถวิเคราะห์ Resume ได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง";
}

await markAnalysisRunFailed(
  job.data.analysisRunId,
  errorCode,
  errorMessage,
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