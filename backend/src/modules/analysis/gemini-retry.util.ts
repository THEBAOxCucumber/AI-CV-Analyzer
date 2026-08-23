export interface GeminiErrorDetails {
  status?: number;
  code?: number | string;
  message?: string;
}

export function getGeminiErrorDetails(
  error: unknown,
): GeminiErrorDetails {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return {};
  }

  const candidate = error as {
    status?: unknown;
    code?: unknown;
    message?: unknown;
  };

  return {
    status:
      typeof candidate.status === "number"
        ? candidate.status
        : undefined,

    code:
      typeof candidate.code === "number" ||
      typeof candidate.code === "string"
        ? candidate.code
        : undefined,

    message:
      typeof candidate.message === "string"
        ? candidate.message
        : undefined,
  };
}

export function isRetryableGeminiError(
  error: unknown,
): boolean {
  if (
    typeof error !== "object" ||
    error === null
  ) {
    return false;
  }

  const candidate =
    error as {
      status?: unknown;
      code?: unknown;
    };

  return (
    candidate.status === 429 ||
    candidate.status === 503 ||
    candidate.code === 429 ||
    candidate.code === 503
  );
}