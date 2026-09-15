import {
    afterAll,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import type {
    ResultSetHeader,
    RowDataPacket,
} from "mysql2/promise";

import {
    database,
} from "../../src/config/database.js";

const {
    mockEnqueueResumeAnalysis,
} = vi.hoisted(() => ({
    mockEnqueueResumeAnalysis:
        vi.fn(),
}));

vi.mock(
    "../../src/modules/analysis/resume-analysis-queue.service.js",
    () => ({
        enqueueResumeAnalysis:
            mockEnqueueResumeAnalysis,
    }),
);

import {
    dispatchAnalysisOutboxBatch,
} from "../../src/modules/analysis/analysis-outbox-dispatcher.service.js";

interface OutboxRow
    extends RowDataPacket {
    id: number;
    analysis_run_id: number;
    status: "PENDING" | "DISPATCHED";
    attempt_count: number;
    last_error: string | null;
    dispatched_at: Date | null;
}

async function createTestUser(): Promise<number> {
    const unique =
        `${Date.now()}-${Math.random()}`;

    const [result] =
        await database.execute<ResultSetHeader>(
            `
        INSERT INTO users (
          first_name,
          last_name,
          email,
          password_hash
        )
        VALUES (?, ?, ?, ?)
      `,
            [
                "Outbox",
                "Test",
                `outbox-${unique}@test.local`,
                "not-used-in-this-test",
            ],
        );

    return result.insertId;
}

async function createTestResume(
    userId: number,
): Promise<number> {
    const [result] =
        await database.execute<ResultSetHeader>(
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
          'outbox-test.pdf',
          'outbox-test.pdf',
          'uploads/outbox-test.pdf',
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

async function createAnalysisRun(
    userId: number,
    resumeId: number,
): Promise<number> {
    /*
     * Dispatcher ต้องการ analysis run ที่มีอยู่จริง
     * แต่ test นี้ไม่ได้ให้ worker ประมวลผล
     * จึงสร้าง run โดยตรงใน DB
     */
    const [result] =
        await database.execute<ResultSetHeader>(
            `
        INSERT INTO resume_analysis_runs (
          resume_id,
          user_id,
          job_description_id,
          analysis_type,
          status,
          prompt_version,
          queued_at
        )
        VALUES (
            ?,
            ?,
            NULL,
            'BASE',
            'QUEUED',
            'resume-analysis-v2.0.0',
            NOW()
            )
        `,
            [
                resumeId,
                userId,
            ],
        );

    return result.insertId;
}

async function createOutboxEvent(
    analysisRunId: number,
): Promise<number> {
    const [result] =
        await database.execute<ResultSetHeader>(
            `
        INSERT INTO analysis_outbox (
          analysis_run_id,
          event_type,
          status
        )
        VALUES (
          ?,
          'RESUME_ANALYSIS_REQUESTED',
          'PENDING'
        )
      `,
            [analysisRunId],
        );

    return result.insertId;
}

async function findOutboxEvent(
    outboxId: number,
): Promise<OutboxRow> {
    const [rows] =
        await database.execute<OutboxRow[]>(
            `
        SELECT
          id,
          analysis_run_id,
          status,
          attempt_count,
          last_error,
          dispatched_at
        FROM analysis_outbox
        WHERE id = ?
        LIMIT 1
      `,
            [outboxId],
        );

    const row = rows[0];

    if (!row) {
        throw new Error(
            `Outbox event ${outboxId} was not found`,
        );
    }

    return row;
}

describe(
    "analysis outbox dispatcher integration",
    () => {
        beforeEach(async () => {
            mockEnqueueResumeAnalysis
                .mockReset();

            /*
             * ป้องกัน PENDING event จาก test/run ก่อนหน้า
             * ถูก dispatcher หยิบมาด้วย
             */
            await database.execute(
                `
          DELETE FROM analysis_outbox
        `,
            );
        });

        afterAll(async () => {
            await database.execute(
                `
          DELETE FROM analysis_outbox
        `,
            );
        });

        it(
            "marks PENDING event as DISPATCHED after enqueue succeeds",
            async () => {
                mockEnqueueResumeAnalysis
                    .mockResolvedValue(undefined);

                const userId =
                    await createTestUser();

                const resumeId =
                    await createTestResume(
                        userId,
                    );

                const analysisRunId =
                    await createAnalysisRun(
                        userId,
                        resumeId,
                    );

                const outboxId =
                    await createOutboxEvent(
                        analysisRunId,
                    );

                await dispatchAnalysisOutboxBatch();

                expect(
                    mockEnqueueResumeAnalysis,
                ).toHaveBeenCalledTimes(1);

                expect(
                    mockEnqueueResumeAnalysis,
                ).toHaveBeenCalledWith(
                    expect.objectContaining({
                        id: analysisRunId,
                        userId,
                        analysisType: "BASE",
                        status: "QUEUED",
                    }),
                );

                const event =
                    await findOutboxEvent(
                        outboxId,
                    );

                expect(event.status)
                    .toBe("DISPATCHED");

                expect(event.attempt_count)
                    .toBe(0);

                expect(event.last_error)
                    .toBeNull();

                expect(event.dispatched_at)
                    .not.toBeNull();
            },
        );

        it(
            "keeps event PENDING and records failure when enqueue fails",
            async () => {
                mockEnqueueResumeAnalysis
                    .mockRejectedValue(
                        new Error(
                            "Redis unavailable",
                        ),
                    );

                const userId =
                    await createTestUser();

                const resumeId =
                    await createTestResume(
                        userId,
                    );

                const analysisRunId =
                    await createAnalysisRun(
                        userId,
                        resumeId,
                    );

                const outboxId =
                    await createOutboxEvent(
                        analysisRunId,
                    );

                await dispatchAnalysisOutboxBatch();

                expect(
                    mockEnqueueResumeAnalysis,
                ).toHaveBeenCalledTimes(1);

                const event =
                    await findOutboxEvent(
                        outboxId,
                    );

                expect(event.status)
                    .toBe("PENDING");

                expect(event.attempt_count)
                    .toBe(1);

                expect(event.last_error)
                    .toBe("Redis unavailable");

                expect(event.dispatched_at)
                    .toBeNull();
            },
        );

        it(
            "recovers a pending outbox event after a temporary enqueue failure",
            async () => {
                const userId =
                    await createTestUser();

                const resumeId =
                    await createTestResume(
                        userId,
                    );

                const analysisRunId =
                    await createAnalysisRun(
                        userId,
                        resumeId,
                    );

                const outboxId =
                    await createOutboxEvent(
                        analysisRunId,
                    );

                /*
                 * รอบแรก:
                 * queue/Redis ล้มเหลวชั่วคราว
                 */
                mockEnqueueResumeAnalysis
                    .mockRejectedValueOnce(
                        new Error(
                            "Redis temporarily unavailable",
                        ),
                    );

                await dispatchAnalysisOutboxBatch();

                const failedEvent =
                    await findOutboxEvent(
                        outboxId,
                    );

                expect(
                    failedEvent.status,
                ).toBe("PENDING");

                expect(
                    failedEvent.attempt_count,
                ).toBe(1);

                expect(
                    failedEvent.last_error,
                ).toBe(
                    "Redis temporarily unavailable",
                );

                expect(
                    failedEvent.dispatched_at,
                ).toBeNull();

                /*
                 * รอบสอง:
                 * queue กลับมาใช้งานได้
                 */
                mockEnqueueResumeAnalysis
                    .mockResolvedValueOnce(
                        undefined,
                    );

                await dispatchAnalysisOutboxBatch();

                const recoveredEvent =
                    await findOutboxEvent(
                        outboxId,
                    );

                expect(
                    recoveredEvent.status,
                ).toBe("DISPATCHED");

                /*
                 * attempt_count เพิ่มเฉพาะตอน failure
                 */
                expect(
                    recoveredEvent.attempt_count,
                ).toBe(1);

                expect(
                    recoveredEvent.last_error,
                ).toBeNull();

                expect(
                    recoveredEvent.dispatched_at,
                ).not.toBeNull();

                expect(
                    mockEnqueueResumeAnalysis,
                ).toHaveBeenCalledTimes(2);

                expect(
                    mockEnqueueResumeAnalysis,
                ).toHaveBeenLastCalledWith(
                    expect.objectContaining({
                        id: analysisRunId,
                        resumeId,
                        userId,
                        analysisType: "BASE",
                        status: "QUEUED",
                    }),
                );
            },
        );

        it(
            "retries dispatch when enqueue succeeded but marking DISPATCHED failed",
            async () => {
                mockEnqueueResumeAnalysis
                    .mockResolvedValue(undefined);

                const userId =
                    await createTestUser();

                const resumeId =
                    await createTestResume(
                        userId,
                    );

                const analysisRunId =
                    await createAnalysisRun(
                        userId,
                        resumeId,
                    );

                const outboxId =
                    await createOutboxEvent(
                        analysisRunId,
                    );

                /*
                 * จำลอง failure หลัง enqueue สำเร็จ
                 * โดยทำให้ outbox row หายก่อน mark DISPATCHED
                 */
                const originalExecute =
                    database.execute.bind(database);

                const executeSpy =
                    vi.spyOn(
                        database,
                        "execute",
                    );

                executeSpy.mockImplementation(
                    async (
                        sql:
                            | string
                            | import("mysql2").QueryOptions,
                        values?: unknown,
                    ) => {
                        if (
                            typeof sql === "string" &&
                            sql.includes(
                                "UPDATE analysis_outbox",
                            ) &&
                            sql.includes(
                                "status = 'DISPATCHED'",
                            )
                        ) {
                            throw new Error(
                                "Database write failed",
                            );
                        }

                        return originalExecute(
                            sql as never,
                            values as never,
                        );
                    },
                );

                await dispatchAnalysisOutboxBatch();

                executeSpy.mockRestore();

                const failedEvent =
                    await findOutboxEvent(
                        outboxId,
                    );

                expect(
                    failedEvent.status,
                ).toBe("PENDING");

                expect(
                    failedEvent.attempt_count,
                ).toBe(1);

                expect(
                    failedEvent.last_error,
                ).toContain(
                    "Database write failed",
                );

                /*
                 * รอบใหม่ต้องพยายาม enqueue ซ้ำ
                 */
                await dispatchAnalysisOutboxBatch();

                const recoveredEvent =
                    await findOutboxEvent(
                        outboxId,
                    );

                expect(
                    recoveredEvent.status,
                ).toBe("DISPATCHED");

                expect(
                    mockEnqueueResumeAnalysis,
                ).toHaveBeenCalledTimes(2);
            },
        );

    },
);

