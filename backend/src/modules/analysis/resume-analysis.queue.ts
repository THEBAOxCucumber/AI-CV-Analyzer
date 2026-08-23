import { Queue } from "bullmq";

import { env } from "../../config/env.js";
import {
  redisConnection,
} from "../../config/redis.js";

import type {
  ResumeAnalysisJobData,
} from "./resume-analysis-queue.types.js";


export const resumeAnalysisQueue =
  new Queue<ResumeAnalysisJobData>(
    env.analysisQueue.name,
    {
      connection:
        redisConnection,

      defaultJobOptions: {
        attempts:
          env.analysisQueue.maxAttempts,

        backoff: {
          type: "exponential",
          delay:
            env.analysisQueue.retryDelayMs,
        },

        removeOnComplete: {
          age: 60 * 60 * 24,
          count: 1000,
        },

        removeOnFail: {
          age: 60 * 60 * 24 * 7,
          count: 5000,
        },
      },
    },
  );