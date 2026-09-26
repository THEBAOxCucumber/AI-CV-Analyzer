import { describe, expect, it } from "vitest";

import { AppError } from "../../src/errors/app-error.js";

import {
  getRetryableLlmReason,
} from "../../src/modules/analysis/llm-retry.util.js";

/*
 * รูปร่างเดียวกับ ResponseError ของ ollama
 * (package ไม่ได้ export class นี้)
 */
function createOllamaResponseError(
  message: string,
  statusCode: number,
) {
  return Object.assign(
    new Error(message),
    {
      name: "ResponseError",
      status_code: statusCode,
    },
  );
}

function createFetchError(
  code: string,
) {
  return new TypeError(
    "fetch failed",
    {
      cause: Object.assign(
        new Error(code),
        { code },
      ),
    },
  );
}

describe("getRetryableLlmReason", () => {
  it("treats unreachable Ollama server as UNAVAILABLE", () => {
    expect(
      getRetryableLlmReason(
        createFetchError("ECONNREFUSED"),
      ),
    ).toBe("UNAVAILABLE");
  });

  it("treats Ollama 5xx ResponseError as UNAVAILABLE", () => {
    expect(
      getRetryableLlmReason(
        createOllamaResponseError(
          "model failed to load",
          500,
        ),
      ),
    ).toBe("UNAVAILABLE");
  });

  it("treats AbortSignal timeout as TIMEOUT", () => {
    expect(
      getRetryableLlmReason(
        new DOMException(
          "The operation was aborted due to timeout",
          "TimeoutError",
        ),
      ),
    ).toBe("TIMEOUT");
  });

  it("treats undici headers timeout as TIMEOUT", () => {
    expect(
      getRetryableLlmReason(
        createFetchError("UND_ERR_HEADERS_TIMEOUT"),
      ),
    ).toBe("TIMEOUT");
  });

  it("does not retry Ollama 404 model not found", () => {
    expect(
      getRetryableLlmReason(
        createOllamaResponseError(
          "model not found",
          404,
        ),
      ),
    ).toBeNull();
  });

  it("does not retry application errors", () => {
    expect(
      getRetryableLlmReason(
        new AppError(
          "invalid analysis",
          502,
          "OLLAMA_INVALID_ANALYSIS_RESPONSE",
        ),
      ),
    ).toBeNull();

    expect(
      getRetryableLlmReason(
        "unknown",
      ),
    ).toBeNull();
  });
});
