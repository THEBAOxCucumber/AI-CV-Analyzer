import request from "supertest";

import {
    afterAll,
    beforeAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

const {
    mockGenerateContent,
} = vi.hoisted(() => ({
    mockGenerateContent: vi.fn(),
}));

vi.mock(
    "../../src/config/gemini.js",
    () => ({
        gemini: {
            models: {
                generateContent:
                    mockGenerateContent,
            },
        },
    }),
);

import {
    app,
} from "../../src/app.js";

import {
    database,
} from "../../src/config/database.js";

import type {
    RowDataPacket,
} from "mysql2";

import {
    redisConnection,
} from "../../src/config/redis.js";

import {
    resumeAnalysisQueue,
} from "../../src/modules/analysis/resume-analysis.queue.js";

import {
    resumeAnalysisWorker,
} from "../../src/workers/resume-analysis.worker.js";

function createSuccessfulGeminiResponse() {
    return {
        text: JSON.stringify({
            baseResumeScore: 80,

            jobMatchScore: null,

            scores: {
                contactInformation: 8,
                professionalSummary: 12,
                skills: 16,
                experience: 20,
                projects: 8,
                education: 8,
                readability: 8,
            },

            jobMatch: null,

            summary:
                "Resume มีพื้นฐานด้าน Backend Development ที่ชัดเจน",

            strengths: [
                "มีทักษะ Node.js และ Express",
                "มีประสบการณ์ทำโปรเจกต์ Backend",
            ],

            weaknesses: [
                "ยังขาดผลลัพธ์เชิงตัวเลขในประสบการณ์",
            ],

            recommendations: [
                "เพิ่มตัวเลขผลลัพธ์ของโครงการและประสบการณ์",
            ],
        }),
    };
}

async function createTestUserAndToken() {
    const unique =
        `${Date.now()}-${Math.random()}`;

    const email =
        `worker-${unique}@test.local`;

    const password =
        "TestPassword123!";

    const registerResponse =
        await request(app)
            .post("/api/auth/register")
            .send({
                firstName: "Worker",
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
            Array<
                import("mysql2").RowDataPacket & {
                    id: number;
                }
            >
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
        token: token as string,
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
          page_count,
          character_count,
          extraction_status,
          chunking_status,
          chunk_count,
          status
        )
        VALUES (
          ?,
          'integration-test.pdf',
          'integration-test.pdf',
          'uploads/integration-test.pdf',
          'application/pdf',
          1000,
          'Experienced Node.js developer with Express and MySQL.',
          1,
          55,
          'COMPLETED',
          'COMPLETED',
          1,
          'COMPLETED'
        )
      `,
            [userId],
        );

    return result.insertId;
}

async function createCompletedResumeChunk(
    resumeId: number,
    userId: number,
): Promise<void> {
    await database.execute(
        `
      INSERT INTO resume_chunks (
        resume_id,
        user_id,
        section,
        chunk_index,
        content,
        character_count,
        embedding_status
      )
      VALUES (
        ?,
        ?,
        'EXPERIENCE',
        0,
        ?,
        ?,
        'COMPLETED'
      )
    `,
        [
            resumeId,
            userId,
            "Backend Developer experienced with Node.js, Express and MySQL.",
            61,
        ],
    );
}

interface AnalysisStatusRow
    extends RowDataPacket {
    id: number;
    status: string;
    base_resume_score: number | null;
    job_match_score: number | null;
    attempt_count: number;
    error_code: string | null;
    error_message: string | null;
}

async function waitForAnalysisStatus(
  analysisRunId: number,
  expectedStatus: string,
  timeoutMs = 15_000,
): Promise<AnalysisStatusRow> {
  const startedAt =
    Date.now();

  let lastRow:
    | AnalysisStatusRow
    | undefined;

  while (
    Date.now() - startedAt <
    timeoutMs
  ) {
    const [rows] =
      await database.execute<
        AnalysisStatusRow[]
      >(
        `
          SELECT
            id,
            status,
            base_resume_score,
            job_match_score,
            attempt_count,
            error_code,
            error_message
          FROM resume_analysis_runs
          WHERE id = ?
          LIMIT 1
        `,
        [analysisRunId],
      );

    const row = rows[0];

    lastRow = row;

    if (
      row?.status ===
      expectedStatus
    ) {
      return row;
    }

    if (
      row?.status === "FAILED"
    ) {
      throw new Error(
        [
          `Analysis ${analysisRunId} failed`,
          `code=${row.error_code ?? "UNKNOWN"}`,
          `message=${row.error_message ?? "UNKNOWN"}`,
        ].join(" | "),
      );
    }

    await new Promise(
      (resolve) =>
        setTimeout(resolve, 100),
    );
  }

  const job =
    await resumeAnalysisQueue.getJob(
      `analysis-${analysisRunId}`,
    );

  const jobState =
    job
      ? await job.getState()
      : "NOT_FOUND";

  throw new Error(
    [
      `Timed out waiting for analysis ${analysisRunId}`,
      `expected=${expectedStatus}`,
      `dbStatus=${lastRow?.status ?? "NOT_FOUND"}`,
      `attemptCount=${lastRow?.attempt_count ?? "UNKNOWN"}`,
      `jobState=${jobState}`,
    ].join(" | "),
  );
}

beforeAll(async () => {
    await resumeAnalysisQueue.waitUntilReady();
    await resumeAnalysisWorker.waitUntilReady();

    console.log("Test queue and worker ready", {
        queueName:
            resumeAnalysisQueue.name,
        workerRunning:
            resumeAnalysisWorker.isRunning(),
    });
});

beforeEach(async () => {
    mockGenerateContent.mockReset();

    await resumeAnalysisQueue.drain(
        true,
    );

    const rateLimitKeys =
        await redisConnection.keys(
            "analysis:rate-limit:user:*",
        );

    if (
        rateLimitKeys.length > 0
    ) {
        await redisConnection.del(
            ...rateLimitKeys,
        );
    }
});

describe(
    "Resume analysis worker",
    () => {
        it(
            "processes POST → QUEUED → Worker → COMPLETED",
            async () => {
                /*
                 * Gemini mock
                 */
                mockGenerateContent
                    .mockResolvedValue(
                        createSuccessfulGeminiResponse(),
                    );

                /*
                 * User
                 */
                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                /*
                 * Resume + Chunk
                 */
                const resumeId =
                    await createCompletedResume(
                        userId,
                    );

                await createCompletedResumeChunk(
                    resumeId,
                    userId,
                );

                /*
                 * POST Analysis
                 */
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
                    analysisRun,
                ).toBeTruthy();

                expect(
                    analysisRun.status,
                ).toBe("QUEUED");

                const analysisRunId =
                    Number(
                        analysisRun.id,
                    );

                const jobId =
                    `analysis-${analysisRunId}`;

                const job =
                    await resumeAnalysisQueue.getJob(
                        jobId,
                    );

                expect(job).toBeTruthy();

                const jobState =
                    await job!.getState();

                console.log(
                    "BullMQ job after POST:",
                    {
                        jobId,
                        jobState,
                    },
                );

                expect(
                    analysisRunId,
                ).toBeGreaterThan(0);

                /*
                 * Worker ทำงาน background
                 */
                const completed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "COMPLETED",
                    );

                /*
                 * ตรวจ DB
                 */
                expect(
                    completed.status,
                ).toBe("COMPLETED");

                expect(
                    completed.base_resume_score,
                ).toBe(80);

                expect(
                    completed.job_match_score,
                ).toBeNull();

                expect(
                    completed.attempt_count,
                ).toBe(1);

                /*
                 * Gemini ต้องถูกเรียก 1 ครั้ง
                 */
                expect(
                    mockGenerateContent,
                ).toHaveBeenCalledTimes(1);
            },
        );
    },
);

afterAll(async () => {
    await resumeAnalysisWorker.close();
    await resumeAnalysisQueue.close();
});

