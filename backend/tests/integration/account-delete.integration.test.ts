import fs from "node:fs/promises";
import path from "node:path";

import request from "supertest";
import type { ResultSetHeader, RowDataPacket } from "mysql2";
import {
  describe,
  expect,
  it,
} from "vitest";

import { app } from "../../src/app.js";
import { database } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";

const PASSWORD = "TestPassword123!";

async function createUserAndToken(role: "USER" | "ADMIN" = "USER") {
  const email =
    `account-delete-${Date.now()}-${Math.random()}@test.local`;

  const registerResponse = await request(app)
    .post("/api/auth/register")
    .send({ firstName: "Delete", lastName: "Me", email, password: PASSWORD });

  expect(registerResponse.status).toBe(201);

  const userId = registerResponse.body.data.user.id as number;

  if (role === "ADMIN") {
    await database.execute("UPDATE users SET role = 'ADMIN' WHERE id = ?", [userId]);
  }

  const loginResponse = await request(app)
    .post("/api/auth/login")
    .send({ email, password: PASSWORD });

  expect(loginResponse.status).toBe(200);

  return {
    email,
    userId,
    token: loginResponse.body.data.token as string,
  };
}

// Resume + ไฟล์จริงบนดิสก์ (ไม่ผ่าน upload → ไม่เรียก embedding API)
async function createResumeWithFile(userId: number) {
  await fs.mkdir(env.upload.resumeDirectory, { recursive: true });

  const filePath = path.resolve(
    env.upload.resumeDirectory,
    `account-delete-${Date.now()}-${Math.random()}.pdf`,
  );

  await fs.writeFile(filePath, "%PDF-1.4 test");

  const [result] = await database.execute<ResultSetHeader>(
    `
      INSERT INTO resumes (
        user_id, original_name, stored_name, file_path, mime_type, file_size,
        extracted_text, character_count, extraction_status, chunking_status, status
      )
      VALUES (?, 'delete-me.pdf', 'delete-me.pdf', ?, 'application/pdf', 13,
              'Node.js', 7, 'COMPLETED', 'COMPLETED', 'COMPLETED')
    `,
    [userId, filePath],
  );

  return { resumeId: result.insertId, filePath };
}

async function fileExists(filePath: string): Promise<boolean> {
  return fs.access(filePath).then(() => true, () => false);
}

async function countRows(sql: string, params: unknown[]): Promise<number> {
  const [rows] = await database.execute<(RowDataPacket & { total: number })[]>(sql, params);
  return Number(rows[0]?.total ?? 0);
}

describe("DELETE /api/auth/account", () => {
  it("deletes the user, their resumes and files, and invalidates the token", async () => {
    const { email, userId, token } = await createUserAndToken();
    const { filePath } = await createResumeWithFile(userId);

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, confirmEmail: email.toUpperCase() });

    expect(response.status).toBe(200);

    expect(await countRows("SELECT COUNT(*) AS total FROM users WHERE id = ?", [userId])).toBe(0);
    expect(await countRows("SELECT COUNT(*) AS total FROM resumes WHERE user_id = ?", [userId])).toBe(0);
    expect(await fileExists(filePath)).toBe(false);

    const me = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);

    expect(me.status).toBe(401);

    const login = await request(app)
      .post("/api/auth/login")
      .send({ email, password: PASSWORD });

    expect(login.status).toBe(401);
  });

  it("rejects a wrong password with 400 and keeps the account", async () => {
    const { email, userId, token } = await createUserAndToken();

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: "WrongPassword123!", confirmEmail: email });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("INVALID_CURRENT_PASSWORD");
    expect(await countRows("SELECT COUNT(*) AS total FROM users WHERE id = ?", [userId])).toBe(1);
  });

  it("rejects a mismatched confirmation email", async () => {
    const { userId, token } = await createUserAndToken();

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, confirmEmail: "someone-else@test.local" });

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("CONFIRM_EMAIL_MISMATCH");
    expect(await countRows("SELECT COUNT(*) AS total FROM users WHERE id = ?", [userId])).toBe(1);
  });

  it("requires authentication", async () => {
    const response = await request(app)
      .delete("/api/auth/account")
      .send({ currentPassword: PASSWORD, confirmEmail: "x@test.local" });

    expect(response.status).toBe(401);
  });

  it("lets an admin delete their account when another admin exists", async () => {
    await createUserAndToken("ADMIN");
    const { email, userId, token } = await createUserAndToken("ADMIN");

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${token}`)
      .send({ currentPassword: PASSWORD, confirmEmail: email });

    expect(response.status).toBe(200);
    expect(await countRows("SELECT COUNT(*) AS total FROM users WHERE id = ?", [userId])).toBe(0);
  });
});

describe("DELETE /api/resumes/:resumeId", () => {
  it("removes the PDF file from disk", async () => {
    const { userId, token } = await createUserAndToken();
    const { resumeId, filePath } = await createResumeWithFile(userId);

    expect(await fileExists(filePath)).toBe(true);

    const response = await request(app)
      .delete(`/api/resumes/${resumeId}`)
      .set("Authorization", `Bearer ${token}`);

    expect(response.status).toBe(200);
    expect(await fileExists(filePath)).toBe(false);
  });
});
