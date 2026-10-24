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

// code อาจเป็นเลขหรือข้อความตัวเลข ("429")
function toNumericCode(
  code: GeminiErrorDetails["code"],
): number | undefined {
  if (typeof code === "number") {
    return code;
  }

  if (typeof code === "string" && /^\d+$/.test(code)) {
    return Number(code);
  }

  return undefined;
}

export function isRetryableGeminiError(
  error: unknown,
): boolean {
  const {
    status,
    code,
  } = getGeminiErrorDetails(error);

  const httpStatus =
    status ?? toNumericCode(code);

  return (
    httpStatus === 408 ||
    httpStatus === 429 ||
    httpStatus === 500 ||
    httpStatus === 502 ||
    httpStatus === 503 ||
    httpStatus === 504
  );
}