import {
  dispatchAnalysisOutboxBatch,
} from "./analysis-outbox-dispatcher.service.js";

const DISPATCH_INTERVAL_MS = 1_000;

let timer:
  | NodeJS.Timeout
  | null = null;

let isDispatching = false;

let currentDispatch:
  Promise<void>
  | null = null;


async function runDispatchCycle(): Promise<void> {
  if (isDispatching) {
    return currentDispatch ?? Promise.resolve();
  }

  isDispatching = true;

  currentDispatch = (async () => {
    try {
      await dispatchAnalysisOutboxBatch();
    } catch (error) {
      console.error(
        "Analysis outbox dispatcher cycle failed:",
        error instanceof Error
          ? error.message
          : String(error),
      );
    } finally {
      isDispatching = false;
      currentDispatch = null;
    }
  })();

  return currentDispatch;
}

export function startAnalysisOutboxDispatcher(): void {
  if (timer) {
    return;
  }

  void runDispatchCycle();

  timer = setInterval(() => {
    void runDispatchCycle();
  }, DISPATCH_INTERVAL_MS);
}

export async function stopAnalysisOutboxDispatcher(): Promise<void> {
  if (timer) {
    clearInterval(timer);
    timer = null;
  }

  if (currentDispatch) {
    await currentDispatch;
  }
}