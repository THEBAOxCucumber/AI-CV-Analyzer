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

import {
    createJobDescription,
} from "../../src/modules/job-description/job-description.repository.js";

import {
    dispatchAnalysisOutboxBatch,
} from "../../src/modules/analysis/analysis-outbox-dispatcher.service.js";

const {
    mockChat,
} = vi.hoisted(() => ({
    mockChat: vi.fn(),
}));

vi.mock(
    "ollama",
    () => ({
        Ollama: class {
            chat = mockChat;
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


/*
 * รูปร่างเดียวกับ ResponseError ของ ollama
 */
function createOllamaModelNotFoundError() {
    return Object.assign(
        new Error(
            "model 'qwen3:4b-instruct' not found",
        ),
        {
            name: "ResponseError",
            status_code: 404,
        },
    );
}


function createSuccessfulOllamaResponse() {
    return {
        message: {
            content: JSON.stringify({
            /*
             * LLM บวกผิด (section รวม = 80)
             * backend ต้อง normalize เป็น 80
             */
            baseResumeScore: 75,

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
        },
    };
}

function createSuccessfulJobMatchOllamaResponse() {
    return {
        message: {
            content: JSON.stringify({
            baseResumeScore: 80,
            jobMatchScore: 86,
            scores: {
                contactInformation: 8,
                professionalSummary: 12,
                skills: 16,
                experience: 20,
                projects: 8,
                education: 8,
                readability: 8,
            },
            jobMatch: {
                score: 86,
                matchedSkills: [
                    "Node.js",
                    "Express",
                    "MySQL",
                ],
                missingSkills: [
                    "Docker",
                ],
                keywordMatches: [
                    "Backend Developer",
                    "REST API",
                    "Node.js",
                ],
            },
            summary:
                "Resume เหมาะกับตำแหน่ง Backend Developer",
            strengths: [
                "มีประสบการณ์ Backend",
                "มีทักษะ Node.js และ Express",
            ],
            weaknesses: [
                "ยังไม่มี Docker ระบุใน Resume",
            ],
            recommendations: [
                "เพิ่มประสบการณ์ Docker หากมี",
            ],
            }),
        },
    };
}

/*
 * Ollama server ไม่ได้เปิด
 */
function createOllamaUnreachableError() {
    return new TypeError(
        "fetch failed",
        {
            cause: Object.assign(
                new Error(
                    "connect ECONNREFUSED 127.0.0.1:11434",
                ),
                {
                    code: "ECONNREFUSED",
                },
            ),
        },
    );
}

/*
 * AbortSignal.timeout()
 */
function createOllamaTimeoutError() {
    return new DOMException(
        "The operation was aborted due to timeout",
        "TimeoutError",
    );
}

function createInvalidJsonOllamaResponse() {
    return {
        message: {
            content:
                "ขออภัย ไม่สามารถวิเคราะห์ได้",
        },
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
    mockChat.mockReset();

    await resumeAnalysisQueue.drain(
        true,
    );

    await database.execute(
        `
      DELETE FROM analysis_outbox
    `,
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
                 * Ollama mock
                 */
                mockChat
                    .mockResolvedValue(
                        createSuccessfulOllamaResponse(),
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

                await dispatchAnalysisOutboxBatch();

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
                 * Ollama ต้องถูกเรียก 1 ครั้ง
                 */
                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(1);
            },
        );

        it(
            "skips a stale duplicate job after the analysis is already completed",
            async () => {
                mockChat
                    .mockResolvedValue(
                        createSuccessfulOllamaResponse(),
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
                 * สร้าง analysis ตาม flow จริง
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
                            analysisType: "BASE",
                        });


                expect(
                    response.status,
                ).toBe(202);

                const analysisRunId =
                    Number(
                        response.body.data
                            .analysisRun.id,
                    );


                const [beforeDispatchRows] =
                    await database.execute<
                        Array<
                            RowDataPacket & {
                                id: number;
                                status: string;
                                attempt_count: number;
                                last_error: string | null;
                            }
                        >
                    >(
                        `
      SELECT
        id,
        status,
        attempt_count,
        last_error
      FROM analysis_outbox
      WHERE analysis_run_id = ?
      LIMIT 1
    `,
                        [analysisRunId],
                    );

                console.log(
                    "Outbox before dispatch:",
                    {
                        analysisRunId,
                        row: beforeDispatchRows[0],
                    },
                );

                expect(
                    beforeDispatchRows[0]?.status,
                ).toBe("PENDING");

                await dispatchAnalysisOutboxBatch();

                const [afterDispatchRows] =
                    await database.execute<
                        Array<
                            RowDataPacket & {
                                id: number;
                                status: string;
                                attempt_count: number;
                                last_error: string | null;
                            }
                        >
                    >(
                        `
      SELECT
        id,
        status,
        attempt_count,
        last_error
      FROM analysis_outbox
      WHERE analysis_run_id = ?
      LIMIT 1
    `,
                        [analysisRunId],
                    );

                console.log(
                    "Outbox after dispatch:",
                    {
                        analysisRunId,
                        row: afterDispatchRows[0],
                    },
                );

                const queuedJob =
                    await resumeAnalysisQueue.getJob(
                        `analysis-${analysisRunId}`,
                    );

                console.log(
                    "Job immediately after dispatch:",
                    {
                        analysisRunId,
                        found: Boolean(queuedJob),
                        state: queuedJob
                            ? await queuedJob.getState()
                            : "NOT_FOUND",
                    },
                );

                expect(
                    afterDispatchRows[0]?.status,
                ).toBe("DISPATCHED");

                expect(queuedJob)
                    .toBeTruthy();

                /*
                 * รอ job แรกทำเสร็จ
                 */
                const completed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "COMPLETED",
                    );
                expect(

                    completed.status,
                ).toBe("COMPLETED");

                expect(
                    completed.attempt_count,
                ).toBe(1);

                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(1);

                /*
                 * เอา payload จาก job จริง
                 */
                const originalJob =
                    await resumeAnalysisQueue.getJob(
                        `analysis-${analysisRunId}`,
                    );

                expect(
                    originalJob,
                ).toBeTruthy();

                /*
                 * จำลอง duplicate/stale delivery
                 * ด้วย jobId ใหม่
                 */
                const duplicateJob =
                    await resumeAnalysisQueue.add(
                        "analyze-resume",
                        originalJob!.data,
                        {
                            jobId:
                                `stale-analysis-${analysisRunId}`,
                        },
                    );

                /*
                 * รอ duplicate job จบ
                 */
                const startedAt =
                    Date.now();

                while (
                    Date.now() - startedAt <
                    10_000
                ) {
                    const state =
                        await duplicateJob.getState();

                    if (
                        state === "completed"
                    ) {
                        break;
                    }

                    if (
                        state === "failed"
                    ) {
                        throw new Error(
                            "Stale duplicate job unexpectedly failed",
                        );
                    }

                    await new Promise(
                        (resolve) =>
                            setTimeout(
                                resolve,
                                100,
                            ),
                    );
                }

                expect(
                    await duplicateJob.getState(),
                ).toBe("completed");

                /*
                 * สำคัญ:
                 * duplicate job ต้องไม่เรียก Ollama
                 */
                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(1);

                /*
                 * DB ต้องไม่ถูก process รอบสอง
                 */
                const [rows] =
                    await database.execute<
                        Array<
                            RowDataPacket & {
                                status: string;
                                attempt_count:
                                number;
                            }
                        >
                    >(
                        `
                    SELECT
                        status,
                        attempt_count
                    FROM resume_analysis_runs
                    WHERE id = ?
                    LIMIT 1
                `,
                        [
                            analysisRunId,
                        ],
                    );

                expect(
                    rows[0]?.status,
                ).toBe("COMPLETED");

                expect(
                    rows[0]?.attempt_count,
                ).toBe(1);
            },
        );


        it(
            "retries when Ollama is unreachable and completes on the second attempt",
            async () => {
                mockChat
                    .mockRejectedValueOnce(
                        createOllamaUnreachableError(),
                    )
                    .mockResolvedValueOnce(
                        createSuccessfulOllamaResponse(),
                    );

                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                const resumeId =
                    await createCompletedResume(
                        userId,
                    );

                await createCompletedResumeChunk(
                    resumeId,
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

                await dispatchAnalysisOutboxBatch();

                expect(
                    response.status,
                ).toBe(202);

                const analysisRun =
                    response.body.data
                        .analysisRun;

                const analysisRunId =
                    Number(
                        analysisRun.id,
                    );

                await dispatchAnalysisOutboxBatch();

                const completed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "COMPLETED",
                    );

                expect(
                    completed.status,
                ).toBe("COMPLETED");

                expect(
                    completed.base_resume_score,
                ).toBe(80);

                expect(
                    completed.attempt_count,
                ).toBe(2);

                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(2);
            },
        );

        it(
            "fails immediately without retry when Ollama returns invalid JSON",
            async () => {
                mockChat.mockResolvedValue(
                    createInvalidJsonOllamaResponse(),
                );

                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                const resumeId =
                    await createCompletedResume(
                        userId,
                    );

                await createCompletedResumeChunk(
                    resumeId,
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

                const analysisRun =
                    response.body.data
                        .analysisRun;

                const analysisRunId =
                    Number(
                        analysisRun.id,
                    );

                await dispatchAnalysisOutboxBatch();

                const failed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "FAILED",
                    );

                expect(
                    failed.attempt_count,
                ).toBe(1);

                expect(
                    failed.error_code,
                ).toBe(
                    "NON_RETRYABLE_ANALYSIS_ERROR",
                );

                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(1);
            },
        );

        it(
            "fails immediately when the Ollama model is not found",
            async () => {
                mockChat.mockRejectedValue(
                    createOllamaModelNotFoundError(),
                );

                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                const resumeId =
                    await createCompletedResume(
                        userId,
                    );

                await createCompletedResumeChunk(
                    resumeId,
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

                expect(
                    response.status,
                ).toBe(202);

                const analysisRun =
                    response.body.data
                        .analysisRun;

                const analysisRunId =
                    Number(
                        analysisRun.id,
                    );

                await dispatchAnalysisOutboxBatch();

                const failed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "FAILED",
                    );

                expect(
                    failed.status,
                ).toBe("FAILED");

                expect(
                    failed.attempt_count,
                ).toBe(1);

                expect(
                    failed.error_code,
                ).toBe(
                    "NON_RETRYABLE_ANALYSIS_ERROR",
                );

                expect(
                    failed.error_message,
                ).toBe(
                    "ไม่สามารถวิเคราะห์ Resume ได้ กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง",
                );

                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(1);
            },
        );

        it(
            "marks analysis as unavailable after Ollama unreachable retries are exhausted",
            async () => {
                mockChat.mockRejectedValue(
                    createOllamaUnreachableError(),
                );

                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                const resumeId =
                    await createCompletedResume(
                        userId,
                    );

                await createCompletedResumeChunk(
                    resumeId,
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

                expect(
                    response.status,
                ).toBe(202);

                const analysisRun =
                    response.body.data
                        .analysisRun;

                const analysisRunId =
                    Number(
                        analysisRun.id,
                    );

                await dispatchAnalysisOutboxBatch();

                const failed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "FAILED",
                    );

                expect(
                    failed.status,
                ).toBe("FAILED");

                expect(
                    failed.attempt_count,
                ).toBe(3);

                expect(
                    failed.error_code,
                ).toBe(
                    "LLM_UNAVAILABLE",
                );

                expect(
                    failed.error_message,
                ).toBe(
                    "ระบบ AI ไม่พร้อมให้บริการชั่วคราว กรุณาลองใหม่อีกครั้งในภายหลัง",
                );

                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(3);
            },
        );

        it(
  "marks analysis as timed out after Ollama timeout retries are exhausted",
  async () => {
    mockChat.mockRejectedValue(
      createOllamaTimeoutError(),
    );

    const {
      userId,
      token,
    } =
      await createTestUserAndToken();

    const resumeId =
      await createCompletedResume(
        userId,
      );

    await createCompletedResumeChunk(
      resumeId,
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

    expect(
      response.status,
    ).toBe(202);

    const analysisRun =
      response.body.data
        .analysisRun;

    const analysisRunId =
      Number(
        analysisRun.id,
      );

    await dispatchAnalysisOutboxBatch();

    const failed =
      await waitForAnalysisStatus(
        analysisRunId,
        "FAILED",
      );

    expect(
      failed.status,
    ).toBe("FAILED");

    expect(
      failed.attempt_count,
    ).toBe(3);

    expect(
      failed.error_code,
    ).toBe(
      "LLM_TIMEOUT",
    );

    expect(
      failed.error_message,
    ).toBe(
      "ระบบ AI ใช้เวลาวิเคราะห์นานเกินกำหนด กรุณาลองใหม่อีกครั้ง",
    );

    expect(
      mockChat,
    ).toHaveBeenCalledTimes(3);
  },
);

        it(
            "processes JOB_MATCH analysis and stores job match score",
            async () => {
                mockChat.mockResolvedValueOnce(
                    createSuccessfulJobMatchOllamaResponse(),
                );

                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                const resumeId =
                    await createCompletedResume(
                        userId,
                    );

                await createCompletedResumeChunk(
                    resumeId,
                    userId,
                );

                const jobDescription =
                    await createJobDescription({
                        userId,
                        title:
                            "Backend Developer",
                        company:
                            "Test Company",
                        description:
                            [
                                "Looking for a Backend Developer",
                                "with Node.js, Express, MySQL,",
                                "REST API, and Docker experience.",
                            ].join(" "),
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
                            analysisType:
                                "JOB_MATCH",
                            jobDescriptionId:
                                jobDescription.id,
                        });

                expect(
                    response.status,
                ).toBe(202);

                const analysisRun =
                    response.body.data
                        .analysisRun;

                const analysisRunId =
                    Number(
                        analysisRun.id,
                    );

                await dispatchAnalysisOutboxBatch();

                const completed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "COMPLETED",
                    );

                expect(
                    completed.status,
                ).toBe("COMPLETED");

                expect(
                    completed.base_resume_score,
                ).toBe(80);

                expect(
                    completed.job_match_score,
                ).toBe(86);

                expect(
                    completed.attempt_count,
                ).toBe(1);

                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(1);
            },
        );

        it(
            "processes COMBINED analysis and stores both scores",
            async () => {
                mockChat.mockResolvedValueOnce(
                    createSuccessfulJobMatchOllamaResponse(),
                );

                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                const resumeId =
                    await createCompletedResume(
                        userId,
                    );

                await createCompletedResumeChunk(
                    resumeId,
                    userId,
                );

                const jobDescription =
                    await createJobDescription({
                        userId,
                        title:
                            "Backend Developer",
                        company:
                            "Test Company",
                        description:
                            [
                                "Looking for a Backend Developer",
                                "with Node.js, Express, MySQL,",
                                "REST API, and Docker experience.",
                            ].join(" "),
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
                            analysisType:
                                "COMBINED",
                            jobDescriptionId:
                                jobDescription.id,
                        });

                expect(
                    response.status,
                ).toBe(202);

                const analysisRunId =
                    Number(
                        response.body.data
                            .analysisRun.id,
                    );
                await dispatchAnalysisOutboxBatch();

                const completed =
                    await waitForAnalysisStatus(
                        analysisRunId,
                        "COMPLETED",
                    );

                expect(
                    completed.status,
                ).toBe("COMPLETED");

                expect(
                    completed.base_resume_score,
                ).toBe(80);

                expect(
                    completed.job_match_score,
                ).toBe(86);

                expect(
                    completed.attempt_count,
                ).toBe(1);

                expect(
                    mockChat,
                ).toHaveBeenCalledTimes(1);
            },
        );

    },
);

afterAll(async () => {
    await resumeAnalysisWorker.close();
    await resumeAnalysisQueue.close();
});

it(
    "skips a concurrent duplicate job while the original analysis is processing",
    async () => {
        let releaseOllama:
            (() => void) | undefined;

        const ollamaBlocked =
            new Promise<void>(
                (resolve) => {
                    releaseOllama =
                        resolve;
                },
            );

        mockChat
            .mockImplementation(
                async () => {
                    await ollamaBlocked;

                    return createSuccessfulOllamaResponse();
                },
            );

        const {
            userId,
            token,
        } =
            await createTestUserAndToken();

        const resumeId =
            await createCompletedResume(
                userId,
            );

        await createCompletedResumeChunk(
            resumeId,
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

        expect(
            response.status,
        ).toBe(202);

        const analysisRunId =
            Number(
                response.body.data
                    .analysisRun.id,
            );
        await dispatchAnalysisOutboxBatch();

        /*
         * รอจน job แรก claim DB
         * และเข้า Ollama แล้ว
         */
        const startedAt =
            Date.now();

        while (
            mockChat.mock.calls
                .length === 0 &&
            Date.now() - startedAt <
            10_000
        ) {
            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        50,
                    ),
            );
        }

        expect(
            mockChat,
        ).toHaveBeenCalledTimes(1);

        /*
         * ตอนนี้ analysis ต้องยัง PROCESSING
         */
        const [processingRows] =
            await database.execute<
                Array<
                    RowDataPacket & {
                        status: string;
                        attempt_count:
                        number;
                        processing_job_id:
                        string | null;
                    }
                >
            >(
                `
                    SELECT
                        status,
                        attempt_count,
                        processing_job_id
                    FROM resume_analysis_runs
                    WHERE id = ?
                    LIMIT 1
                `,
                [
                    analysisRunId,
                ],
            );

        expect(
            processingRows[0]?.status,
        ).toBe("PROCESSING");

        expect(
            processingRows[0]?.attempt_count,
        ).toBe(1);

        expect(
            processingRows[0]
                ?.processing_job_id,
        ).toBe(
            `analysis-${analysisRunId}`,
        );

        /*
         * original job ยังติดอยู่ที่ Ollama
         * สร้าง duplicate คนละ BullMQ job
         */
        const originalJob =
            await resumeAnalysisQueue.getJob(
                `analysis-${analysisRunId}`,
            );

        expect(
            originalJob,
        ).toBeTruthy();

        const duplicateJob =
            await resumeAnalysisQueue.add(
                "analyze-resume",
                originalJob!.data,
                {
                    jobId:
                        `concurrent-duplicate-${analysisRunId}`,
                },
            );

        /*
         * Worker concurrency = 2
         * ดังนั้น duplicate สามารถถูกหยิบ
         * ขณะ original ยัง block อยู่
         */
        const duplicateStartedAt =
            Date.now();

        while (
            Date.now() -
            duplicateStartedAt <
            10_000
        ) {
            const state =
                await duplicateJob.getState();

            if (
                state === "completed"
            ) {
                break;
            }

            if (
                state === "failed"
            ) {
                throw new Error(
                    "Concurrent duplicate job unexpectedly failed",
                );
            }

            await new Promise(
                (resolve) =>
                    setTimeout(
                        resolve,
                        50,
                    ),
            );
        }

        expect(
            await duplicateJob.getState(),
        ).toBe("completed");

        /*
         * duplicate ต้องถูก ownership guard
         * หยุดก่อน Ollama
         */
        expect(
            mockChat,
        ).toHaveBeenCalledTimes(1);

        /*
         * duplicate ต้องไม่เพิ่ม attempt_count
         */
        const [stillProcessingRows] =
            await database.execute<
                Array<
                    RowDataPacket & {
                        status: string;
                        attempt_count:
                        number;
                    }
                >
            >(
                `
                    SELECT
                        status,
                        attempt_count
                    FROM resume_analysis_runs
                    WHERE id = ?
                    LIMIT 1
                `,
                [
                    analysisRunId,
                ],
            );

        expect(
            stillProcessingRows[0]?.status,
        ).toBe("PROCESSING");

        expect(
            stillProcessingRows[0]
                ?.attempt_count,
        ).toBe(1);

        /*
         * ปล่อย original Ollama
         */
        releaseOllama?.();

        const completed =
            await waitForAnalysisStatus(
                analysisRunId,
                "COMPLETED",
            );

        expect(
            completed.status,
        ).toBe("COMPLETED");

        expect(
            completed.attempt_count,
        ).toBe(1);

        expect(
            mockChat,
        ).toHaveBeenCalledTimes(1);
    },
);