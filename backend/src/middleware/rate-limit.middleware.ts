import {
  ipKeyGenerator,
  rateLimit,
  type Options,
} from "express-rate-limit";
import { Redis } from "ioredis";
import {
  RedisStore,
  type RedisReply,
} from "rate-limit-redis";

import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";

/*
 * connection แยกสำหรับ rate limit
 * - คำสั่งรอ connect ได้ แต่ไม่เกิน commandTimeout → ไม่ทำให้ login ค้าง
 * - passOnStoreError: Redis ล่มแล้วปล่อยผ่าน (ผู้ใช้ยังล็อกอินได้)
 */
export const rateLimitRedis = new Redis({
  host: env.redis.host,
  port: env.redis.port,
  maxRetriesPerRequest: 1,
  commandTimeout: 1_000,
});

rateLimitRedis.on("error", (error) => {
  console.error(
    "Rate limit Redis error:",
    error.message,
  );
});

const REDIS_READY_TIMEOUT_MS = 10_000;

// request รอ store ได้ไม่เกินนี้ — เกินแล้วปล่อยผ่าน (passOnStoreError) ไม่ให้ login ค้าง
const STORE_REQUEST_TIMEOUT_MS = 1_500;

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`Rate limit store timed out after ${ms}ms`)),
      ms,
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/*
 * รอ connection พร้อม (ตอนเปิดเซิร์ฟเวอร์ Redis ใน Docker อาจต่อช้ากว่า commandTimeout)
 */
function whenRedisReady(): Promise<void> {
  if (rateLimitRedis.status === "ready") {
    return Promise.resolve();
  }

  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      rateLimitRedis.off("ready", onReady);
      reject(new Error(`Redis not ready after ${REDIS_READY_TIMEOUT_MS}ms`));
    }, REDIS_READY_TIMEOUT_MS);

    function onReady() {
      clearTimeout(timer);
      resolve();
    }

    rateLimitRedis.once("ready", onReady);
  });
}

/*
 * RedisStore เดิม:
 * - ส่ง SCRIPT LOAD ทันทีตอน import → Redis ยังต่อไม่เสร็จ → timeout + log error
 * - ถ้าโหลดล้มจะเก็บ promise ที่ reject ไว้ตลอด → rate limit ปิดเงียบๆ จนรีสตาร์ต
 * ตัวนี้: รอ Redis พร้อมก่อนโหลด และโหลดใหม่เมื่อเจอ error ครั้งถัดไป
 */
class ResilientRedisStore extends RedisStore {
  private reloadScripts(): void {
    this.incrementScriptSha =
      this.loadIncrementScript();
    this.getScriptSha =
      this.loadGetScript();

    // กัน unhandled rejection — ผู้เรียกจะเจอ error เองตอน await
    this.incrementScriptSha.catch(() => {});
    this.getScriptSha.catch(() => {});
  }

  override async init(
    options: Parameters<RedisStore["init"]>[0],
  ): Promise<void> {
    this.windowMs = options.windowMs;

    // ตั้ง promise ไว้ทันที — request ที่มาก่อน Redis พร้อมจะรอ promise นี้
    const ready = whenRedisReady();

    this.incrementScriptSha = ready.then(() =>
      this.loadIncrementScript(),
    );
    this.getScriptSha = ready.then(() =>
      this.loadGetScript(),
    );

    try {
      await Promise.all([
        this.incrementScriptSha,
        this.getScriptSha,
      ]);
    } catch (error) {
      // ไม่ throw (express-rate-limit จะพิมพ์ stack ยาว) — โหลดใหม่ตอนใช้งานจริง
      console.warn(
        "Rate limit store not ready yet, will retry on first request:",
        error instanceof Error ? error.message : error,
      );
    }
  }

  override async increment(
    key: string,
  ) {
    try {
      return await withTimeout(
        super.increment(key),
        STORE_REQUEST_TIMEOUT_MS,
      );
    } catch (error) {
      this.reloadScripts();
      throw error;
    }
  }

  override async get(
    key: string,
  ) {
    try {
      return await withTimeout(
        super.get(key),
        STORE_REQUEST_TIMEOUT_MS,
      );
    } catch (error) {
      this.reloadScripts();
      throw error;
    }
  }
}

function createStore(
  prefix: string,
): RedisStore {
  return new ResilientRedisStore({
    // แยกตาม NODE_ENV — ตัวนับของเทสต์ไม่ปนกับ dev server (Redis ตัวเดียวกัน)
    prefix: `rate-limit:${env.nodeEnv}:${prefix}:`,
    sendCommand: (command: string, ...args: string[]) =>
      rateLimitRedis.call(
        command,
        ...args,
      ) as Promise<RedisReply>,
  });
}

function rejectWith(
  message: string,
  code: string,
): Options["handler"] {
  return (_req, _res, next) => {
    next(
      new AppError(
        message,
        429,
        code,
      ),
    );
  };
}

const windowMs =
  env.rateLimit.windowMinutes * 60_000;

function loginKeyPrefix(): string {
  return `rate-limit:${env.nodeEnv}:login:`;
}

/*
 * Admin: ปลดล็อกการล็อกอินของอีเมลนี้ (ทุก IP)
 * key = <prefix><ip>:<email> → SCAN หา *:<email>
 * คืนจำนวน key ที่ลบ
 */
export async function clearLoginRateLimit(
  email: string,
): Promise<number> {
  // escape อักขระ glob ของ Redis ในอีเมล
  const escapedEmail = email
    .trim()
    .toLowerCase()
    .replace(/[*?[\]\\]/g, "\\$&");

  const pattern =
    `${loginKeyPrefix()}*:${escapedEmail}`;

  let cursor = "0";
  let deleted = 0;

  do {
    const [nextCursor, keys] =
      await rateLimitRedis.scan(
        cursor,
        "MATCH",
        pattern,
        "COUNT",
        200,
      );

    cursor = nextCursor;

    if (keys.length > 0) {
      deleted += await rateLimitRedis.del(...keys);
    }
  } while (cursor !== "0");

  return deleted;
}

/*
 * ทุก endpoint auth ที่ไม่ต้องล็อกอิน รวมกันต่อ IP
 * กันเดารหัสผ่านแบบเปลี่ยน email ไปเรื่อยๆ / ยิงขอ OTP รัวๆ
 */
export const authIpRateLimit = rateLimit({
  windowMs,
  limit: env.rateLimit.authIpMax,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  passOnStoreError: true,
  store: createStore("auth-ip"),
  // ipKeyGenerator: IPv6 นับเป็น subnet /56 (กันเปลี่ยน IP ใน block เดียวกันเลี่ยง limit)
  keyGenerator: (req) =>
    ipKeyGenerator(req.ip ?? "unknown"),
  handler: rejectWith(
    `มีคำขอมากเกินไป กรุณาลองใหม่ในอีก ${env.rateLimit.windowMinutes} นาที`,
    "TOO_MANY_REQUESTS",
  ),
});

/*
 * ล็อกอินผิดต่อ (IP + email) — นับเฉพาะครั้งที่ไม่สำเร็จ
 * ใช้หลัง validate (body.email ผ่าน schema แล้ว)
 */
export const loginRateLimit = rateLimit({
  windowMs,
  limit: env.rateLimit.loginMaxFailures,
  standardHeaders: "draft-8",
  legacyHeaders: false,
  passOnStoreError: true,
  skipSuccessfulRequests: true,
  store: createStore("login"),
  keyGenerator: (req) => {
    const email = String(
      (req.body as { email?: unknown })
        ?.email ?? "",
    )
      .trim()
      .toLowerCase();

    return `${ipKeyGenerator(req.ip ?? "unknown")}:${email}`;
  },
  handler: rejectWith(
    `เข้าสู่ระบบไม่สำเร็จหลายครั้งเกินไป กรุณาลองใหม่ในอีก ${env.rateLimit.windowMinutes} นาที`,
    "TOO_MANY_LOGIN_ATTEMPTS",
  ),
});
