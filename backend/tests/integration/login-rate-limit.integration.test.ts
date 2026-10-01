import request from "supertest";
import {
  afterAll,
  describe,
  expect,
  it,
} from "vitest";

import { app } from "../../src/app.js";
import { database } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";

const PASSWORD = "TestPassword123!";
const WRONG_PASSWORD = "WrongPassword123!";

const createdEmails: string[] = [];

/*
 * แต่ละเทสต์ใช้ IP ปลอมของตัวเอง (X-Forwarded-For จาก loopback ถูกเชื่อ)
 * → ตัวนับไม่ปนกับเทสต์อื่น / รอบก่อน
 */
function uniqueIp(): string {
  const part = () =>
    Math.floor(Math.random() * 250) + 1;

  return `10.${part()}.${part()}.${part()}`;
}

async function registerUser(): Promise<string> {
  const email =
    `rate-limit-${Date.now()}-${Math.random()}@test.local`;

  const response = await request(app)
    .post("/api/auth/register")
    .set("X-Forwarded-For", uniqueIp())
    .send({
      firstName: "Rate",
      lastName: "Limit",
      email,
      password: PASSWORD,
    });

  expect(response.status).toBe(201);
  createdEmails.push(email);

  return email;
}

function login(
  email: string,
  password: string,
  ip: string,
) {
  return request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", ip)
    .send({ email, password });
}

afterAll(async () => {
  for (const email of createdEmails) {
    await database.execute(
      "DELETE FROM users WHERE email = ?",
      [email],
    );
  }
});

describe("POST /api/auth/login rate limit", () => {
  const maxFailures =
    env.rateLimit.loginMaxFailures;

  it("blocks the account on this IP after too many failed logins", async () => {
    const email = await registerUser();
    const ip = uniqueIp();

    for (let i = 0; i < maxFailures; i++) {
      const response =
        await login(email, WRONG_PASSWORD, ip);

      expect(response.status).toBe(401);
    }

    const blocked =
      await login(email, WRONG_PASSWORD, ip);

    expect(blocked.status).toBe(429);
    expect(blocked.body.code).toBe(
      "TOO_MANY_LOGIN_ATTEMPTS",
    );
    expect(blocked.headers.ratelimit).toBeTruthy();

    // ถูกบล็อกแล้ว รหัสถูกก็เข้าไม่ได้จนหมดเวลา
    const correct =
      await login(email, PASSWORD, ip);

    expect(correct.status).toBe(429);
  });

  it("does not block the same account from another IP", async () => {
    const email = await registerUser();
    const attackerIp = uniqueIp();

    for (let i = 0; i <= maxFailures; i++) {
      await login(email, WRONG_PASSWORD, attackerIp);
    }

    const owner =
      await login(email, PASSWORD, uniqueIp());

    expect(owner.status).toBe(200);
  });

  it("does not block other accounts on the same IP", async () => {
    const victim = await registerUser();
    const other = await registerUser();
    const ip = uniqueIp();

    for (let i = 0; i <= maxFailures; i++) {
      await login(victim, WRONG_PASSWORD, ip);
    }

    const response =
      await login(other, PASSWORD, ip);

    expect(response.status).toBe(200);
  });

  it("does not count successful logins", async () => {
    const email = await registerUser();
    const ip = uniqueIp();

    for (let i = 0; i <= maxFailures + 1; i++) {
      const response =
        await login(email, PASSWORD, ip);

      expect(response.status).toBe(200);
    }
  });

  it("uses the client IP from X-Forwarded-For behind the local proxy", async () => {
    const response = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", "203.0.113.7")
      .send({
        email: "nobody@test.local",
        password: WRONG_PASSWORD,
      });

    // ไม่ error จาก express-rate-limit (ERR_ERL_*) และตอบ 401 ปกติ
    expect(response.status).toBe(401);
  });
});
