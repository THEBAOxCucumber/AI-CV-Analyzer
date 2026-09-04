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

import {
  createJobDescription,
} from "../../src/modules/job-description/job-description.repository.js";

const {
  mockEnqueueResumeAnalysis,
} = vi.hoisted(() => ({
  mockEnqueueResumeAnalysis: vi.fn(),
}));

vi.mock(
  "../../src/modules/analysis/resume-analysis-queue.service.js",
  () => ({
    enqueueResumeAnalysis:
      mockEnqueueResumeAnalysis,
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

async function createAnalysisRunForTest(
  resumeId: number,
  userId: number,
  status:
    | "QUEUED"
    | "PROCESSING"
    | "COMPLETED"
    | "FAILED" = "COMPLETED",
): Promise<number> {
  const [result] =
    await database.execute<
      import("mysql2/promise").ResultSetHeader
    >(
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
  ?,
  ?
)
      `,
      [
        resumeId,
        userId,
        status,
        env.resumeAnalysis.promptVersion,
      ]
    );

  return result.insertId;
}

beforeEach(async () => {

  mockEnqueueResumeAnalysis
    .mockReset()
    .mockResolvedValue(undefined);
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
      ?
    )
  `,
          [
            resumeId,
            userId,
            env.resumeAnalysis.promptVersion,
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

    it(
      "stores the configured prompt version on a new analysis run",
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

        expect(response.status).toBe(202);

        expect(
          response.body.data.analysisRun
            .promptVersion,
        ).toBe(
          env.resumeAnalysis.promptVersion,
        );
      },
    );

    it(
      "returns 400 when BASE includes jobDescriptionId",
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

        const jobDescription =
          await createJobDescription({
            userId,
            title: "Backend Developer",
            company: "Test Company",
            description:
              "Node.js Express MySQL",
          });

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
              jobDescriptionId:
                jobDescription.id,
            });

        expect(response.status).toBe(400);
        expect(response.body.code)
          .toBe("VALIDATION_ERROR");
      },
    );

    it(
      "returns 400 for an invalid analysisType",
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
                "SOMETHING_ELSE",
            });

        expect(response.status).toBe(400);
        expect(response.body.code)
          .toBe("VALIDATION_ERROR");
      },
    );


    it(
      "returns 400 when JOB_MATCH has no jobDescriptionId",
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
                "JOB_MATCH",
            });

        expect(
          response.status,
        ).toBe(400);

        expect(
          response.body.success,
        ).toBe(false);

        expect(
          response.body.code,
        ).toBe(
          "VALIDATION_ERROR",
        );

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

        const rateLimitKey =
          await redisConnection.get(
            `analysis:rate-limit:user:${userId}`,
          );

        expect(
          rateLimitKey,
        ).toBeNull();
      },
    );

    it(
      "returns 404 when JOB_MATCH uses another user's job description",
      async () => {
        const firstUser =
          await createTestUserAndToken();

        const secondUser =
          await createTestUserAndToken();

        const resumeId =
          await createCompletedResume(
            firstUser.userId,
          );

        const foreignJobDescription =
          await createJobDescription({
            userId:
              secondUser.userId,
            title:
              "Backend Developer",
            company:
              "Other Company",
            description:
              "Node.js Express MySQL Docker",
          });

        const response =
          await request(app)
            .post(
              `/api/resumes/${resumeId}/analyses`,
            )
            .set(
              "Authorization",
              `Bearer ${firstUser.token}`,
            )
            .send({
              analysisType:
                "JOB_MATCH",
              jobDescriptionId:
                foreignJobDescription.id,
            });

        expect(
          response.status,
        ).toBe(404);

        expect(
          response.body.success,
        ).toBe(false);

        expect(
          response.body.code,
        ).toBe(
          "JOB_DESCRIPTION_NOT_FOUND",
        );

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
              firstUser.userId,
            ],
          );

        expect(
          runs.length,
        ).toBe(0);

        const rateLimitKey =
          await redisConnection.get(
            `analysis:rate-limit:user:${firstUser.userId}`,
          );

        expect(
          rateLimitKey,
        ).toBeNull();
      },
    );

    it(
      "marks the analysis as failed when enqueueing fails",
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

        mockEnqueueResumeAnalysis
          .mockRejectedValueOnce(
            new Error("Redis unavailable"),
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

        expect(response.status).toBe(503);
        expect(response.body.code).toBe(
          "ANALYSIS_QUEUE_UNAVAILABLE",
        );

        const [rows] =
          await database.execute<
            Array<
              import("mysql2/promise").RowDataPacket & {
                status: string;
                error_code: string | null;
                error_message: string | null;
              }
            >
          >(
            `
          SELECT
            status,
            error_code,
            error_message
          FROM resume_analysis_runs
          WHERE resume_id = ?
            AND user_id = ?
          ORDER BY id DESC
          LIMIT 1
        `,
            [resumeId, userId],
          );

        expect(rows[0]?.status).toBe(
          "FAILED",
        );

        expect(
          rows[0]?.error_code,
        ).toBe("QUEUE_ENQUEUE_FAILED");

        expect(
          rows[0]?.error_message,
        ).toContain("Redis unavailable");
      },
    );

    it(
      "queues BASE analysis without a job description",
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
        ).toBe(202);

        expect(
          response.body.success,
        ).toBe(true);

        const analysisRun =
          response.body.data
            .analysisRun;

        expect(
          analysisRun.analysisType,
        ).toBe("BASE");

        expect(
          analysisRun.status,
        ).toBe("QUEUED");

        expect(
          analysisRun.jobDescriptionId,
        ).toBeNull();

        const [runs] =
          await database.execute<
            Array<
              {
                analysis_type: string;
                status: string;
                job_description_id:
                number | null;
              } &
              import("mysql2")
              .RowDataPacket
            >
          >(
            `
          SELECT
            analysis_type,
            status,
            job_description_id
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
        ).toBe(1);

        expect(
          runs[0]?.analysis_type,
        ).toBe("BASE");

        expect(
          runs[0]?.status,
        ).toBe("QUEUED");

        expect(
          runs[0]?.job_description_id,
        ).toBeNull();
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

describe(
  "GET /api/resumes/:resumeId/analyses",
  () => {
    it(
      "returns analysis history newest first",
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

        const firstRunId =
          await createAnalysisRunForTest(
            resumeId,
            userId,
          );

        const secondRunId =
          await createAnalysisRunForTest(
            resumeId,
            userId,
          );

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(
          response.status,
        ).toBe(200);

        expect(
          response.body.success,
        ).toBe(true);

        const analyses =
          response.body.data
            .analyses;

        expect(
          analyses.length,
        ).toBeGreaterThanOrEqual(
          2,
        );

        expect(
          analyses[0].id,
        ).toBe(secondRunId);

        expect(
          analyses[1].id,
        ).toBe(firstRunId);

        expect(
          response.body.data.analyses[0]
            .promptVersion,
        ).toBe(
          env.resumeAnalysis.promptVersion,
        );
        expect(
          response.body.data.analyses[0]
            .analysisType,
        ).toBe("BASE");

        expect(
          response.body.data.analyses[0]
            .jobDescriptionId,
        ).toBeNull();

      },
    );

    it(
      "respects the history limit",
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

        await createAnalysisRunForTest(
          resumeId,
          userId,
        );

        await createAnalysisRunForTest(
          resumeId,
          userId,
        );

        const newestRunId =
          await createAnalysisRunForTest(
            resumeId,
            userId,
          );

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses?limit=1`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(
          response.status,
        ).toBe(200);

        expect(
          response.body.data
            .analyses,
        ).toHaveLength(1);

        expect(
          response.body.data
            .analyses[0].id,
        ).toBe(newestRunId);
      },
    );

    it(
      "returns COMBINED analysis with jobDescriptionId in history",
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

        const jobDescription =
          await createJobDescription({
            userId,
            title: "Backend Developer",
            company: "Test Company",
            description:
              "Node.js Express MySQL Docker",
          });

        await database.execute(
          `
    INSERT INTO resume_analysis_runs (
      resume_id,
      user_id,
      analysis_type,
      job_description_id,
      status,
      prompt_version
    )
    VALUES (
      ?,
      ?,
      'COMBINED',
      ?,
      'COMPLETED',
      ?
    )
  `,
          [
            resumeId,
            userId,
            jobDescription.id,
            env.resumeAnalysis.promptVersion,
          ],
        );

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(response.status).toBe(200);

        expect(
          response.body.data.analyses[0]
            .analysisType,
        ).toBe("COMBINED");

        expect(
          response.body.data.analyses[0]
            .jobDescriptionId,
        ).toBe(jobDescription.id);
      },
    );

    it(
      "defaults invalid history limit to 20",
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

        for (let index = 0; index < 3; index += 1) {
          await createAnalysisRunForTest(
            resumeId,
            userId,
          );
        }

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses?limit=abc`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(response.status).toBe(200);

        expect(
          response.body.data.analyses,
        ).toHaveLength(3);
      },
    );

    it(
      "uses the minimum history limit when limit is zero",
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

        await createAnalysisRunForTest(
          resumeId,
          userId,
        );

        await createAnalysisRunForTest(
          resumeId,
          userId,
        );

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses?limit=0`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(response.status).toBe(200);

        expect(
          response.body.data.analyses,
        ).toHaveLength(1);
      },
    );

    it(
      "caps the history limit at 100",
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

        for (
          let index = 0;
          index < 3;
          index += 1
        ) {
          await createAnalysisRunForTest(
            resumeId,
            userId,
          );
        }

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses?limit=999`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(response.status).toBe(200);

        expect(
          response.body.data.analyses,
        ).toHaveLength(3);
      },
    );

    it(
      "returns jobDescriptionId for JOB_MATCH history",
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

        const jobDescription =
          await createJobDescription({
            userId,
            title: "Backend Developer",
            company: "Test Company",
            description:
              "Node.js Express MySQL Docker",
          });

        await database.execute(
          `
    INSERT INTO resume_analysis_runs (
      resume_id,
      user_id,
      analysis_type,
      job_description_id,
      status,
      prompt_version
    )
    VALUES (
      ?,
      ?,
      'JOB_MATCH',
      ?,
      'COMPLETED',
      ?
    )
  `,
          [
            resumeId,
            userId,
            jobDescription.id,
            env.resumeAnalysis.promptVersion,
          ],
        );
        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(response.status).toBe(200);

        expect(
          response.body.data.analyses[0]
            .analysisType,
        ).toBe("JOB_MATCH");

        expect(
          response.body.data.analyses[0]
            .jobDescriptionId,
        ).toBe(jobDescription.id);
      },
    );

    it(
      "returns 404 when accessing another user's resume history",
      async () => {
        const owner =
          await createTestUserAndToken();

        const otherUser =
          await createTestUserAndToken();

        const resumeId =
          await createCompletedResume(
            owner.userId,
          );

        await createAnalysisRunForTest(
          resumeId,
          owner.userId,
        );

        const response =
          await request(app)
            .get(
              `/api/resumes/${resumeId}/analyses`,
            )
            .set(
              "Authorization",
              `Bearer ${otherUser.token}`,
            );

        expect(
          response.status,
        ).toBe(404);

        expect(
          response.body.success,
        ).toBe(false);

        expect(
          response.body.code,
        ).toBe(
          "RESUME_NOT_FOUND",
        );
      },
    );


  },
);

describe(
  "GET /api/analyses/:analysisRunId",
  () => {
    it(
      "returns an analysis run by id",
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

        const analysisRunId =
          await createAnalysisRunForTest(
            resumeId,
            userId,
            "COMPLETED",
          );

        const response =
          await request(app)
            .get(
              `/api/analyses/${analysisRunId}`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(
          response.status,
        ).toBe(200);

        expect(
          response.body.success,
        ).toBe(true);

        expect(
          response.body.data
            .analysisRun.id,
        ).toBe(analysisRunId);

        expect(
          response.body.data
            .analysisRun.resumeId,
        ).toBe(resumeId);

        expect(
          response.body.data
            .analysisRun.status,
        ).toBe("COMPLETED");

        expect(
          response.body.data.analysisRun
            .promptVersion,
        ).toBe(env.resumeAnalysis.promptVersion);

        expect(
          response.body.data.analysisRun
            .analysisType,
        ).toBe("BASE");

        expect(
          response.body.data.analysisRun
            .jobDescriptionId,
        ).toBeNull();
      },
    );

    it(
      "returns jobDescriptionId for a JOB_MATCH analysis run",
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

        const jobDescription =
          await createJobDescription({
            userId,
            title: "Backend Developer",
            company: "Test Company",
            description:
              "Node.js Express MySQL Docker",
          });

        const [result] =
          await database.execute<
            import("mysql2/promise").ResultSetHeader
          >(
            `
          INSERT INTO resume_analysis_runs (
            resume_id,
            user_id,
            analysis_type,
            job_description_id,
            status,
            prompt_version
          )
          VALUES (
            ?,
            ?,
            'JOB_MATCH',
            ?,
            'COMPLETED',
            ?
          )
        `,
            [
              resumeId,
              userId,
              jobDescription.id,
              env.resumeAnalysis.promptVersion,
            ],
          );

        const response =
          await request(app)
            .get(
              `/api/analyses/${result.insertId}`,
            )
            .set(
              "Authorization",
              `Bearer ${token}`,
            );

        expect(response.status).toBe(200);

        expect(
          response.body.data.analysisRun
            .analysisType,
        ).toBe("JOB_MATCH");

        expect(
          response.body.data.analysisRun
            .jobDescriptionId,
        ).toBe(jobDescription.id);

        expect(
          response.body.data.analysisRun
            .promptVersion,
        ).toBe(
          env.resumeAnalysis.promptVersion,
        );
      },
    );

    it(
      "returns 404 when accessing another user's analysis run",
      async () => {
        const owner =
          await createTestUserAndToken();

        const otherUser =
          await createTestUserAndToken();

        const resumeId =
          await createCompletedResume(
            owner.userId,
          );

        const analysisRunId =
          await createAnalysisRunForTest(
            resumeId,
            owner.userId,
          );

        const response =
          await request(app)
            .get(
              `/api/analyses/${analysisRunId}`,
            )
            .set(
              "Authorization",
              `Bearer ${otherUser.token}`,
            );

        expect(
          response.status,
        ).toBe(404);

        expect(
          response.body.success,
        ).toBe(false);

        expect(
          response.body.code,
        ).toBe(
          "ANALYSIS_RUN_NOT_FOUND",
        );
      },
    );
  },
);