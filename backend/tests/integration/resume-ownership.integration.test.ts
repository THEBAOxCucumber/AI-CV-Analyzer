import request from "supertest";
import {
  describe,
  expect,
  it,
} from "vitest";

import { app } from "../../src/app.js";
import {
  database,
} from "../../src/config/database.js";

async function createTestUserAndToken() {
  const unique =
    `${Date.now()}-${Math.random()}`;

  const email =
    `resume-ownership-${unique}@test.local`;

  const password =
    "TestPassword123!";

  const registerResponse =
    await request(app)
      .post("/api/auth/register")
      .send({
        firstName: "Ownership",
        lastName: "Test",
        email,
        password,
      });

  expect(
    registerResponse.status,
  ).toBe(201);

  const loginResponse =
    await request(app)
      .post("/api/auth/login")
      .send({
        email,
        password,
      });

  expect(
    loginResponse.status,
  ).toBe(200);

  const token =
    loginResponse.body.data
      ?.accessToken ??
    loginResponse.body.data
      ?.token;

  expect(token).toBeTruthy();

  const [rows] =
    await database.execute<
      Array<{
        id: number;
      } & import("mysql2").RowDataPacket>
    >(
      `
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
      `,
      [email],
    );

  expect(rows).toHaveLength(1);

  return {
    userId: rows[0].id,
    token: String(token),
  };
}

async function createResumeForTest(
  userId: number,
): Promise<number> {
  const [result] =
    await database.execute<
      import(
        "mysql2/promise"
      ).ResultSetHeader
    >(
      `
        INSERT INTO resumes (
          user_id,
          original_name,
          stored_name,
          file_path,
          mime_type,
          file_size,
          extracted_text,
          character_count,
          extraction_status,
          chunking_status,
          status
        )
        VALUES (
          ?,
          'ownership-test.pdf',
          'ownership-test.pdf',
          'uploads/ownership-test.pdf',
          'application/pdf',
          100,
          'Node.js Express MySQL',
          21,
          'COMPLETED',
          'COMPLETED',
          'COMPLETED'
        )
      `,
      [userId],
    );

  return result.insertId;
}

describe(
  "Resume ownership security",
  () => {
    it(
      "prevents another user from creating chunks for a foreign resume",
      async () => {
        const owner =
          await createTestUserAndToken();

        const attacker =
          await createTestUserAndToken();

        const resumeId =
          await createResumeForTest(
            owner.userId,
          );

        const response =
          await request(app)
            .post(
              `/api/resumes/${resumeId}/chunks`,
            )
            .set(
              "Authorization",
              `Bearer ${attacker.token}`,
            );

        expect(response.status).toBe(404);
        expect(response.body.code).toBe(
          "RESUME_NOT_FOUND",
        );
      },
    );

    it(
      "prevents another user from reading chunks of a foreign resume",
      async () => {
        const owner =
          await createTestUserAndToken();

        const attacker =
          await createTestUserAndToken();

        const resumeId =
          await createResumeForTest(
            owner.userId,
          );

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/chunks`,
            )
            .set(
              "Authorization",
              `Bearer ${attacker.token}`,
            );

        expect(response.status).toBe(404);
        expect(response.body.code).toBe(
          "RESUME_NOT_FOUND",
        );
      },
    );

    it(
      "prevents another user from creating embeddings for a foreign resume",
      async () => {
        const owner =
          await createTestUserAndToken();

        const attacker =
          await createTestUserAndToken();

        const resumeId =
          await createResumeForTest(
            owner.userId,
          );

        const response =
          await request(app)
            .post(
              `/api/resumes/${resumeId}/embeddings`,
            )
            .set(
              "Authorization",
              `Bearer ${attacker.token}`,
            );

        expect(response.status).toBe(404);
        expect(response.body.code).toBe(
          "RESUME_NOT_FOUND",
        );
      },
    );

    it(
      "does not expose another user's resume in the resume list",
      async () => {
        const owner =
          await createTestUserAndToken();

        const viewer =
          await createTestUserAndToken();

        const foreignResumeId =
          await createResumeForTest(
            owner.userId,
          );

        const viewerResumeId =
          await createResumeForTest(
            viewer.userId,
          );

        const response =
          await request(app)
            .get("/api/resumes")
            .set(
              "Authorization",
              `Bearer ${viewer.token}`,
            );

        expect(response.status).toBe(200);

        const resumes =
          response.body.data?.resumes;

        expect(
          Array.isArray(resumes),
        ).toBe(true);

        const resumeIds = resumes.map(
          (resume: { id: number }) =>
            resume.id,
        );

        expect(resumeIds).toContain(
          viewerResumeId,
        );

        expect(resumeIds).not.toContain(
          foreignResumeId,
        );
      },
    );
  },
);