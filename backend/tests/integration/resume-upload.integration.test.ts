import request from "supertest";
import {
  describe,
  expect,
  it,
} from "vitest";

import { app } from "../../src/app.js";
import { database } from "../../src/config/database.js";

async function createTestUserAndToken() {
  const unique =
    `${Date.now()}-${Math.random()}`;

  const email =
    `analysis-test-${unique}@test.local`;

  const password =
    "TestPassword123!";

  await request(app)
    .post("/api/auth/register")
    .send({
      firstName: "Integration",
      lastName: "Test",
      email,
      password,
    });

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

  /*
   * ดึง user id จาก DB
   */
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

  const user = rows[0];

  if (!user) {
    throw new Error(
      "Test user not found",
    );
  }

  return {
    userId: user.id,
    token:
      token as string,
  };
}

describe(
  "POST /api/resumes/upload",
  () => {
    it(
      "rejects fake PDF content even when extension and MIME type are valid",
      async () => {
        const { token } =
          await createTestUserAndToken();

        const response =
          await request(app)
            .post("/api/resumes/upload")
            .set(
              "Authorization",
              `Bearer ${token}`,
            )
            .attach(
              "resume",
              Buffer.from(
                "this is not a real pdf",
              ),
              {
                filename:
                  "fake-resume.pdf",
                contentType:
                  "application/pdf",
              },
            );

        expect(response.status).toBe(
          400,
        );

        expect(
          response.body.code,
        ).toBe(
          "INVALID_RESUME_FILE_CONTENT",
        );
      },
    );
  },
);