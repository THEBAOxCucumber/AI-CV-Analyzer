import { afterAll, vi } from "vitest";

/*
 * กันเทสต์เขียนลง DB จริง (เคยสร้างผู้ใช้ทดสอบหลายพันคนใน DB dev)
 */
if (!process.env.DB_NAME?.endsWith("_test")) {
  throw new Error(
    `Tests must use a *_test database (got "${process.env.DB_NAME}"). Run: npm run test:db:setup`,
  );
}

/*
 * ห้ามเทสต์ส่งอีเมลจริง (.env มี SMTP จริง)
 * เทสต์อ่าน OTP จาก sendMail.mock.calls
 */
vi.mock("../src/modules/mail/mail.service.js", () => ({
  isMailConfigured: vi.fn(() => true),
  sendMail: vi.fn(async () => {}),
}));

import {
  database,
} from "../src/config/database.js";

import {
  redisConnection,
} from "../src/config/redis.js";

import {
  rateLimitRedis,
} from "../src/middleware/rate-limit.middleware.js";

afterAll(async () => {
  await database.end();
  await redisConnection.quit();
  await rateLimitRedis.quit();
});