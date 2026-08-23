import { env } from "../../config/env.js";

import {
  redisConnection,
} from "../../config/redis.js";

import { AppError } from "../../errors/app-error.js";

interface RateLimitResult {
  allowed: boolean;
  current: number;
  limit: number;
  remaining: number;
  retryAfterSeconds: number;
}

async function consumeAnalysisRateLimit(
  userId: number,
): Promise<RateLimitResult> {
  const key =
    `analysis:rate-limit:user:${userId}`;

  const limit =
  env.analysisRateLimit.maxRequests;

const windowSeconds =
  env.analysisRateLimit.windowSeconds;

  /*
   * INCR เป็น atomic operation
   * จึงปลอดภัยกว่า GET แล้วค่อย SET
   */
  const current =
    await redisConnection.incr(key);

  /*
   * Request แรกของ window
   * ให้กำหนด TTL
   */
  if (current === 1) {
    await redisConnection.expire(
      key,
      windowSeconds,
    );
  }

  let ttl =
    await redisConnection.ttl(key);

  /*
   * ป้องกันกรณี key ไม่มี TTL
   */
  if (ttl < 0) {
    await redisConnection.expire(
      key,
      windowSeconds,
    );

    ttl = windowSeconds;
  }

  return {
    allowed:
      current <= limit,

    current,

    limit,

    remaining:
      Math.max(
        limit - current,
        0,
      ),

    retryAfterSeconds:
      Math.max(ttl, 0),
  };
}

export async function enforceAnalysisRateLimit(
  userId: number,
): Promise<void> {
  const result =
    await consumeAnalysisRateLimit(
      userId,
    );

  if (result.allowed) {
    return;
  }

  throw new AppError(
    "คุณสร้างคำขอวิเคราะห์ Resume บ่อยเกินไป กรุณาลองใหม่ภายหลัง",
    429,
    "ANALYSIS_RATE_LIMIT_EXCEEDED",
    {
      limit:
        result.limit,

      remaining:
        result.remaining,

      retryAfterSeconds:
        result.retryAfterSeconds,
    },
  );
}