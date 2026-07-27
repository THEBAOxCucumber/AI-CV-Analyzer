import { app } from "./app.js";
import { testDatabaseConnection } from "./config/database.js";
import { env } from "./config/env.js";

async function startServer(): Promise<void> {
  try {
    await testDatabaseConnection();

    app.listen(env.port, () => {
      console.log(`Server is running at http://localhost:${env.port}`);
      console.log(`Environment: ${env.nodeEnv}`);
    });
  } catch (error) {
    console.error("Unable to start server:", error);
    process.exit(1);
  }
}

void startServer();