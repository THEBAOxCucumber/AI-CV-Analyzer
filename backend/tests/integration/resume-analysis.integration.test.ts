import request from "supertest";

import {
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import {
  app,
} from "../../src/app.js";

import {
  database,
} from "../../src/config/database.js";

import {
  redisConnection,
} from "../../src/config/redis.js";

import {
  env,
} from "../../src/config/env.js";

vi.mock(
  "../../src/modules/analysis/resume-analysis-queue.service.js",
  () => ({
    enqueueResumeAnalysis:
      vi.fn().mockResolvedValue(
        undefined,
      ),
  }),
);

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

async function createCompletedResume(
  userId: number,
): Promise<number> {
  const [result] =
    await database.execute<
      import("mysql2/promise").ResultSetHeader
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
          'test.pdf',
          'test.pdf',
          'uploads/test.pdf',
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

beforeEach(async () => {
  /*
   * ล้าง rate-limit keys
   * เพื่อไม่ให้ test ก่อนหน้ากระทบ test ถัดไป
   */
  const keys =
    await redisConnection.keys(
      "analysis:rate-limit:user:*",
    );

  if (keys.length > 0) {
    await redisConnection.del(
      ...keys,
    );
  }
});

describe(
  "POST /api/resumes/:resumeId/analyses",
  () => {
    it(
      "returns 409 when an active analysis already exists",
      async () => {
        const {
          userId,
          token,
        } =
          await createTestUserAndToken();

        const resumeId =
          await createCompletedResume(
            userId,
          );

        /*
         * สร้าง active analysis ไว้ก่อน
         */
        await database.execute(
          `
            INSERT INTO resume_analysis_runs (
              resume_id,
              user_id,
              analysis_type,
              status,
              prompt_version
            )
            VALUES (
              ?,
              ?,
              'BASE',
              'QUEUED',
              'test-v1'
            )
          `,
          [
            resumeId,
            userId,
          ],
        );

        const response =
          await request(app)
            .post(
              `/api/resumes/${resumeId}/analyses`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            )
            .send({
              analysisType:
                "BASE",
            });

        expect(
          response.status,
        ).toBe(409);

        expect(
          response.body.success,
        ).toBe(false);

        expect(
          response.body.code,
        ).toBe(
          "ANALYSIS_ALREADY_IN_PROGRESS",
        );
      },
    );
  },
);

it(
  "returns 429 when the user exceeds analysis rate limit",
  async () => {
    const {
      userId,
      token,
    } =
      await createTestUserAndToken();

    const resumeId =
      await createCompletedResume(
        userId,
      );

    const key =
      `analysis:rate-limit:user:${userId}`;

    /*
     * ทำให้ request ถัดไปเกิน limit
     */
    await redisConnection.set(
      key,
      String(
        env.analysisRateLimit
          .maxRequests,
      ),
      "EX",
      env.analysisRateLimit
        .windowSeconds,
    );

    const response =
      await request(app)
        .post(
          `/api/resumes/${resumeId}/analyses`,
        )
        .set(
          "Authorization",
          `Bearer ${token}`,
        )
        .send({
          analysisType: "BASE",
        });

    expect(
      response.status,
    ).toBe(429);

    expect(
      response.body.success,
    ).toBe(false);

    expect(
      response.body.code,
    ).toBe(
      "ANALYSIS_RATE_LIMIT_EXCEEDED",
    );

    /*
     * ต้องไม่สร้าง analysis run
     */
    const [runs] =
      await database.execute<
        Array<
          import("mysql2")
            .RowDataPacket
        >
      >(
        `
          SELECT id
          FROM resume_analysis_runs
          WHERE resume_id = ?
            AND user_id = ?
        `,
        [
          resumeId,
          userId,
        ],
      );

    expect(
      runs.length,
    ).toBe(0);
  },
);