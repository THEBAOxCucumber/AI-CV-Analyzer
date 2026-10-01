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

/*
 * "false" → ไม่เชื่อ proxy, ตัวเลข → จำนวน hop, อื่นๆ → ส่งให้ Express ตรงๆ (เช่น "loopback")
 */
function parseTrustProxy(
  value: string,
): boolean | number | string {
  if (value === "false") {
    return false;
  }

  if (/^\d+$/.test(value)) {
    return Number(value);
  }

  return value;
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
      "15m",
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
      "gemini-3.7-flash",


  fallbackModel:
    process.env
      .GEMINI_FALLBACK_MODEL ??
    "gemini-3.8-flash",

      
  },

  ollama: {
  host:
    process.env.OLLAMA_HOST ??
    "http://127.0.0.1:11434",

  model:
    process.env.OLLAMA_MODEL ??
    "qwen3:4b-instruct",

  /*
   * ต้องน้อยกว่า headersTimeout
   * ของ Node fetch (300s)
   */
  timeoutMs:
    getNumberEnv(
      "OLLAMA_TIMEOUT_MS",
      240_000,
    ),
},

  /*
   * SMTP — Gmail: smtp.gmail.com:465 + App Password
   * ไม่ตั้ง SMTP_USER/SMTP_PASSWORD = ส่งอีเมลไม่ได้
   */
  mail: {
    host:
      process.env.SMTP_HOST ??
      "smtp.gmail.com",

    port:
      getNumberEnv(
        "SMTP_PORT",
        465,
      ),

    user:
      process.env.SMTP_USER ?? "",

    password:
      process.env.SMTP_PASSWORD ?? "",

    from:
      process.env.MAIL_FROM ??
      process.env.SMTP_USER ??
      "",
  },

  passwordReset: {
    otpTtlMinutes:
      getNumberEnv(
        "PASSWORD_RESET_OTP_TTL_MINUTES",
        10,
      ),

    maxAttempts:
      getNumberEnv(
        "PASSWORD_RESET_MAX_ATTEMPTS",
        5,
      ),

    resendCooldownSeconds:
      getNumberEnv(
        "PASSWORD_RESET_RESEND_COOLDOWN_SECONDS",
        60,
      ),
  },

  jooble: {
    apiKey:
      getRequiredEnv(
        "JOOBLE_API_KEY",
      ),

    baseUrl:
      process.env
        .JOOBLE_BASE_URL ??
      "https://jooble.org/api",
  },

  careerjet: {
    apiKey:
      getRequiredEnv(
        "CAREERJET_API_KEY",
      ),

    baseUrl:
      process.env
        .CAREERJET_BASE_URL ??
      "https://search.api.careerjet.net",

    localeCode:
      process.env
        .CAREERJET_LOCALE_CODE ??
      "th_TH",
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

  admin: {
    // งาน QUEUED/PROCESSING ที่ค้างเกินนี้ → หน้า Admin ยกเลิกได้
    stuckMinutes:
      getNumberEnv(
        "ADMIN_STUCK_MINUTES",
        30,
      ),
  },

  /*
   * Rate limit หน้า auth
   * TRUST_PROXY: request ผ่าน Vite proxy / Cloudflare tunnel (localhost)
   * → "loopback" ให้ req.ip เป็น IP จริงของผู้ใช้ ไม่ใช่ 127.0.0.1
   */
  rateLimit: {
    trustProxy:
      parseTrustProxy(
        process.env.TRUST_PROXY ??
        "loopback",
      ),

    windowMinutes:
      getNumberEnv(
        "RATE_LIMIT_WINDOW_MINUTES",
        15,
      ),

    // ล็อกอินผิดต่อ (IP + email)
    loginMaxFailures:
      getNumberEnv(
        "RATE_LIMIT_LOGIN_MAX_FAILURES",
        5,
      ),

    // register / login / forgot / reset รวมกันต่อ IP
    authIpMax:
      getNumberEnv(
        "RATE_LIMIT_AUTH_IP_MAX",
        30,
      ),
  },

  cors: {
    origin:
      process.env.CORS_ORIGIN ??
      "http://localhost:5173",
  },

};