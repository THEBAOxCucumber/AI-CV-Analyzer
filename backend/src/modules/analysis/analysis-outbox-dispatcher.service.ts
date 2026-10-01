import {
  findPendingAnalysisOutboxEvents,
  markAnalysisOutboxDispatched,
  recordAnalysisOutboxFailure,
  RESUME_ANALYSIS_REQUESTED_EVENT,
  type AnalysisOutboxRecord,
} from "./analysis-outbox.repository.js";

import {
  findAnalysisRunByIdInternal,
} from "./resume-analysis-run.repository.js";

import {
  enqueueResumeAnalysis,
} from "./resume-analysis-queue.service.js";

function toErrorMessage(
  error: unknown,
): string {
  return error instanceof Error
    ? error.message
    : String(error);
}

/**
 * ส่ง event เดียวเข้า queue
 * ผิดพลาดตรงไหนให้ throw → handleDispatchFailure
 */
async function dispatchEvent(
  event: AnalysisOutboxRecord,
): Promise<void> {
  if (
    event.eventType !==
    RESUME_ANALYSIS_REQUESTED_EVENT
  ) {
    throw new Error(
      `Unsupported analysis outbox event: ${event.eventType}`,
    );
  }

  const analysisRun =
    await findAnalysisRunByIdInternal(
      event.analysisRunId,
    );

  if (!analysisRun) {
    throw new Error(
      `Analysis run ${event.analysisRunId} was not found`,
    );
  }

  /*
   * Deterministic BullMQ jobId:
   * analysis-${analysisRun.id}
   *
   * ทำให้การ dispatch ซ้ำมี idempotency
   * ที่ queue layer ด้วย
   */
  await enqueueResumeAnalysis(
    analysisRun,
  );

  const marked =
    await markAnalysisOutboxDispatched(
      event.id,
    );

  if (!marked) {
    console.warn(
      "Analysis outbox event was already dispatched:",
      {
        outboxId: event.id,
        analysisRunId:
          event.analysisRunId,
      },
    );
  }
}

/**
 * บันทึกความล้มเหลวลง outbox (เพื่อ retry รอบหน้า)
 * บันทึกไม่สำเร็จก็แค่ log — ไม่ให้ batch หยุด
 */
async function handleDispatchFailure(
  event: AnalysisOutboxRecord,
  error: unknown,
): Promise<void> {
  const message =
    toErrorMessage(error);

  try {
    await recordAnalysisOutboxFailure(
      event.id,
      message,
    );
  } catch (recordError) {
    console.error(
      "Failed to record analysis outbox dispatch failure:",
      {
        outboxId: event.id,
        analysisRunId:
          event.analysisRunId,
        dispatchError: message,
        recordError:
          toErrorMessage(recordError),
      },
    );
  }

  console.error(
    "Failed to dispatch analysis outbox event:",
    {
      outboxId: event.id,
      analysisRunId:
        event.analysisRunId,
      error: message,
    },
  );
}

export async function dispatchAnalysisOutboxBatch(
  limit = 20,
): Promise<void> {
  const events =
    await findPendingAnalysisOutboxEvents(
      limit,
    );

  for (const event of events) {
    try {
      await dispatchEvent(event);
    } catch (error) {
      await handleDispatchFailure(
        event,
        error,
      );
    }
  }
}
