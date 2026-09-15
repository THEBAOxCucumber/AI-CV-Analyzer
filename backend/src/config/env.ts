import dotenv from "dotenv";

dotenv.config();

function getRequiredEnv(
  name: string,
): string {
  const value = process.env[name];

  if (!value) {
    throw new Error(
      `Environment variable ${name} is required`,
    );
  }

  return value;
}

function getJwtSecret(): string {
  const secret =
    getRequiredEnv("JWT_SECRET");

  if (
    process.env.NODE_ENV ===
    "production" &&
    secret.length < 32
  ) {
    throw new Error(
      "JWT_SECRET must be at least 32 characters in production",
    );
  }

  return secret;
}

function getNumberEnv(
  key: string,
  fallback: number,
): number {
  const rawValue = process.env[key];

  if (!rawValue) {
    return fallback;
  }

  const parsedValue =
    Number(rawValue);

  if (!Number.isFinite(parsedValue)) {
    throw new Error(
      `${key} ต้องเป็นตัวเลข`,
    );
  }

  return parsedValue;
}

export const env = {
  nodeEnv:
    process.env.NODE_ENV ??
    "development",

  port: getNumberEnv(
    "PORT",
    5000,
  ),

  database: {
    host:
      getRequiredEnv("DB_HOST"),

    port:
      getNumberEnv(
        "DB_PORT",
        3306,
      ),

    user:
      getRequiredEnv("DB_USER"),

    password:
      process.env.DB_PASSWORD ??
      "",

    name:
      getRequiredEnv("DB_NAME"),
  },

  jwt: {
    secret: getJwtSecret(),

    expiresIn:
      process.env.JWT_EXPIRES_IN ??
      "1d",
  },

  upload: {
    resumeDirectory:
      process.env.UPLOAD_DIR ??
      "uploads/resumes",

    maxResumeSizeMb:
      getNumberEnv(
        "MAX_RESUME_SIZE_MB",
        5,
      ),
  },

  embedding: {
    provider:
      process.env.EMBEDDING_PROVIDER ??
      "gemini",

    model:
      process.env.EMBEDDING_MODEL ??
      "gemini-embedding-001",

    dimensions:
      getNumberEnv(
        "EMBEDDING_DIMENSIONS",
        1536,
      ),

    batchSize:
      getNumberEnv(
        "EMBEDDING_BATCH_SIZE",
        20,
      ),
  },

  gemini: {
    apiKey:
      getRequiredEnv(
        "GEMINI_API_KEY",
      ),

    generationModel:
      process.env
        .GEMINI_GENERATION_MODEL ??
      "gemini-3.6-flash",
  },

  qdrant: {
    url:
      process.env.QDRANT_URL ??
      "http://localhost:6333",

    apiKey:
      process.env.QDRANT_API_KEY ||
      undefined,

    collection:
      process.env.QDRANT_COLLECTION ??
      "resume_chunks_gemini_1536",
  },

  semanticSearch: {
    defaultLimit:
      getNumberEnv(
        "SEMANTIC_SEARCH_LIMIT",
        5,
      ),

    scoreThreshold:
      getNumberEnv(
        "SEMANTIC_SCORE_THRESHOLD",
        0.45,
      ),
  },

  /*
   * Resume Analysis
   */
  resumeAnalysis: {
    promptVersion:
      process.env
        .RESUME_ANALYSIS_PROMPT_VERSION ??
      "resume-analysis-v2.0.0",

    maxContextCharacters:
      getNumberEnv(
        "RESUME_ANALYSIS_MAX_CONTEXT_CHARS",
        40_000,
      ),
  },

  /*
   * Redis
   */
  redis: {
    host:
      process.env.REDIS_HOST ??
      "127.0.0.1",

    port:
      getNumberEnv(
        "REDIS_PORT",
        6379,
      ),
  },

  /*
   * BullMQ
   */
  analysisQueue: {
    name:
      process.env
        .ANALYSIS_QUEUE_NAME ??
      "resume-analysis",

    maxAttempts:
      getNumberEnv(
        "ANALYSIS_MAX_ATTEMPTS",
        3,
      ),

    retryDelayMs:
      getNumberEnv(
        "ANALYSIS_RETRY_DELAY_MS",
        3000,
      ),
  },

  /*
   * Analysis Rate Limit
   */
  analysisRateLimit: {
    maxRequests:
      getNumberEnv(
        "ANALYSIS_RATE_LIMIT_MAX",
        5,
      ),

    windowSeconds:
      getNumberEnv(
        "ANALYSIS_RATE_LIMIT_WINDOW_SECONDS",
        600,
      ),
  },

  cors: {
    origin:
      process.env.CORS_ORIGIN ??
      "http://localhost:5173",
  },

};