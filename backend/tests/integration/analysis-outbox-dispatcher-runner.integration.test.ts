import {
    afterEach,
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

const {
    mockDispatchAnalysisOutboxBatch,
} = vi.hoisted(() => ({
    mockDispatchAnalysisOutboxBatch:
        vi.fn(),
}));

vi.mock(
    "../../src/modules/analysis/analysis-outbox-dispatcher.service.js",
    () => ({
        dispatchAnalysisOutboxBatch:
            mockDispatchAnalysisOutboxBatch,
    }),
);

import {
    startAnalysisOutboxDispatcher,
    stopAnalysisOutboxDispatcher,
} from "../../src/modules/analysis/analysis-outbox-dispatcher.runner.js";

describe(
    "analysis outbox dispatcher runner",
    () => {
        beforeEach(() => {
            vi.useFakeTimers();

            mockDispatchAnalysisOutboxBatch
                .mockReset()
                .mockResolvedValue(undefined);

            stopAnalysisOutboxDispatcher();
        });

        afterEach(() => {
            stopAnalysisOutboxDispatcher();
            vi.useRealTimers();
        });

        it(
            "runs immediately when started",
            async () => {
                startAnalysisOutboxDispatcher();

                await vi.runAllTicks();

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(1);
            },
        );

        it(
            "runs again on the configured interval",
            async () => {
                startAnalysisOutboxDispatcher();

                await vi.runAllTicks();

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(
                    1_000,
                );

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(2);
            },
        );

        it(
            "does not start a second interval when called twice",
            async () => {
                startAnalysisOutboxDispatcher();
                startAnalysisOutboxDispatcher();

                await vi.runAllTicks();

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(1);

                await vi.advanceTimersByTimeAsync(
                    1_000,
                );

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(2);
            },
        );

        it(
            "does not overlap dispatch cycles",
            async () => {
                let resolveFirstDispatch:
                    (() => void) | undefined;

                mockDispatchAnalysisOutboxBatch
                    .mockImplementationOnce(
                        () =>
                            new Promise<void>(
                                (resolve) => {
                                    resolveFirstDispatch =
                                        resolve;
                                },
                            ),
                    )
                    .mockResolvedValue(undefined);

                startAnalysisOutboxDispatcher();

                await vi.runAllTicks();

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(1);

                /*
                 * รอบแรกยังไม่เสร็จ
                 * interval ที่ผ่านไประหว่างนี้
                 * ต้องไม่สร้าง dispatch ซ้อน
                 */
                await vi.advanceTimersByTimeAsync(
                    3_000,
                );

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(1);

                /*
                 * ปล่อยรอบแรกให้จบ
                 */
                resolveFirstDispatch?.();

                await vi.runAllTicks();

                /*
                 * interval รอบถัดไป
                 * สามารถ dispatch ได้ตามปกติ
                 */
                await vi.advanceTimersByTimeAsync(
                    1_000,
                );

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(2);
            },
        );

        
        it(
            "stops future dispatch cycles",
            async () => {
                startAnalysisOutboxDispatcher();

                await vi.runAllTicks();

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(1);

                stopAnalysisOutboxDispatcher();

                await vi.advanceTimersByTimeAsync(
                    5_000,
                );

                expect(
                    mockDispatchAnalysisOutboxBatch,
                ).toHaveBeenCalledTimes(1);
            },
        );
    },
);