import { afterAll, vi } from "vitest";

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

afterAll(async () => {
  await database.end();
  await redisConnection.quit();
});