import { app } from "./app.js";
import { testDatabaseConnection } from "./config/database.js";
import { env } from "./config/env.js";

import {
  startAnalysisOutboxDispatcher,
  stopAnalysisOutboxDispatcher,
} from "./modules/analysis/analysis-outbox-dispatcher.runner.js";

import {
  redisConnection,
} from "./config/redis.js";

import {
  resumeAnalysisQueue,
} from "./modules/analysis/resume-analysis.queue.js";

import {
  resumeAnalysisWorker,
} from "./workers/resume-analysis.worker.js";


let server:
  ReturnType<typeof app.listen>
  | undefined;

let isShuttingDown = false;

async function startServer(): Promise<void> {
  try {
    await testDatabaseConnection();

    server = app.listen(
      env.port,
      () => {
        console.log(
          `Server is running at http://localhost:${env.port}`,
        );
        console.log(
          `Environment: ${env.nodeEnv}`,
        );

        startAnalysisOutboxDispatcher();
      },
    );
  } catch (error) {
    console.error(
      "Unable to start server:",
      error,
    );

    process.exit(1);
  }
}

async function shutdown(
  signal: string,
): Promise<void> {
  if (isShuttingDown) {
    return;
  }

  isShuttingDown = true;

  console.log(
    `Received ${signal}, shutting down...`,
  );

  try {
    if (server) {
      await new Promise<void>(
        (resolve, reject) => {
          server!.close((error) => {
            if (error) {
              reject(error);
              return;
            }

            resolve();
          });
        },
      );
    }

    await stopAnalysisOutboxDispatcher();

    await resumeAnalysisWorker.close();
    await resumeAnalysisQueue.close();
    await redisConnection.quit();

    process.exit(0);
  } catch (error) {
    console.error(
      "Failed to shutdown cleanly:",
      error,
    );

    process.exit(1);
  }
}

process.on("SIGTERM", () => {
  void shutdown("SIGTERM");
});

process.on("SIGINT", () => {
  void shutdown("SIGINT");
});

void startServer();