import {
  findPendingAnalysisOutboxEvents,
  markAnalysisOutboxDispatched,
  recordAnalysisOutboxFailure,
  RESUME_ANALYSIS_REQUESTED_EVENT,
} from "./analysis-outbox.repository.js";

import {
  findAnalysisRunByIdInternal,
} from "./resume-analysis-run.repository.js";

import {
  enqueueResumeAnalysis,
} from "./resume-analysis-queue.service.js";

export async function dispatchAnalysisOutboxBatch(
  limit = 20,
): Promise<void> {
  const events =
    await findPendingAnalysisOutboxEvents(
      limit,
    );

  for (const event of events) {
    try {
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
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : String(error);

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
              recordError instanceof Error
                ? recordError.message
                : String(recordError),
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
  }
}