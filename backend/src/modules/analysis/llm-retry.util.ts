/*
 * จัดประเภท error จาก LLM provider
 * ว่าควรให้ BullMQ retry หรือไม่
 *
 * รองรับ:
 * - Ollama ResponseError (status_code)
 * - HTTP error แบบ status / code
 * - Network error จาก fetch (error.cause.code)
 * - Timeout จาก AbortSignal.timeout()
 */
import { AppError } from "../../errors/app-error.js";

export type RetryableLlmReason =
  | "UNAVAILABLE"
  | "TIMEOUT";

const RETRYABLE_HTTP_STATUSES =
  new Set([
    408,
    429,
    500,
    502,
    503,
    504,
  ]);

const RETRYABLE_NETWORK_CODES =
  new Set([
    "ECONNREFUSED",
    "ECONNRESET",
    "EHOSTUNREACH",
    "EAI_AGAIN",
    "EPIPE",
    "UND_ERR_SOCKET",
    "UND_ERR_CONNECT_TIMEOUT",
  ]);

const TIMEOUT_NETWORK_CODES =
  new Set([
    "ETIMEDOUT",
    "UND_ERR_HEADERS_TIMEOUT",
    "UND_ERR_BODY_TIMEOUT",
  ]);

function toRecord(
  value: unknown,
): Record<string, unknown> | null {
  return typeof value === "object" &&
    value !== null
    ? value as Record<string, unknown>
    : null;
}

function getHttpStatus(
  error: Record<string, unknown>,
): number | undefined {
  const candidates = [
    error.status_code,
    error.status,
    error.code,
  ];

  for (const candidate of candidates) {
    if (
      typeof candidate === "number"
    ) {
      return candidate;
    }

    if (
      typeof candidate === "string" &&
      /^\d+$/.test(candidate)
    ) {
      return Number(candidate);
    }
  }

  return undefined;
}

function getNetworkCode(
  error: Record<string, unknown>,
): string | undefined {
  const cause =
    toRecord(error.cause);

  const code =
    cause?.code ??
    error.code;

  return typeof code === "string"
    ? code
    : undefined;
}

export function getRetryableLlmReason(
  error: unknown,
): RetryableLlmReason | null {
  /*
   * AppError = application/output failure
   * (JSON เสีย, Zod ไม่ผ่าน, chunk ไม่พร้อม)
   * retry ไม่ช่วย
   */
  if (error instanceof AppError) {
    return null;
  }

  const record =
    toRecord(error);

  if (!record) {
    return null;
  }

  /*
   * AbortSignal.timeout() → TimeoutError
   */
  if (
    record.name === "TimeoutError" ||
    record.name === "AbortError"
  ) {
    return "TIMEOUT";
  }

  const networkCode =
    getNetworkCode(record);

  if (
    networkCode &&
    TIMEOUT_NETWORK_CODES.has(
      networkCode,
    )
  ) {
    return "TIMEOUT";
  }

  /*
   * Ollama server ติดต่อไม่ได้
   */
  if (
    networkCode &&
    RETRYABLE_NETWORK_CODES.has(
      networkCode,
    )
  ) {
    return "UNAVAILABLE";
  }

  const httpStatus =
    getHttpStatus(record);

  if (
    httpStatus !== undefined &&
    RETRYABLE_HTTP_STATUSES.has(
      httpStatus,
    )
  ) {
    return "UNAVAILABLE";
  }

  return null;
}
