interface AnalysisScores {
  contactInformation: number;
  professionalSummary: number;
  skills: number;
  experience: number;
  projects: number;
  education: number;
  readability: number;
}

interface JobMatchLike {
  score: number;
}

interface AnalysisResultLike {
  baseResumeScore?: unknown;
  jobMatchScore?: unknown;
  scores?: unknown;
  jobMatch?: unknown;
  [key: string]: unknown;
}

function isAnalysisScores(
  value: unknown,
): value is AnalysisScores {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.contactInformation ===
      "number" &&
    typeof candidate.professionalSummary ===
      "number" &&
    typeof candidate.skills === "number" &&
    typeof candidate.experience === "number" &&
    typeof candidate.projects === "number" &&
    typeof candidate.education === "number" &&
    typeof candidate.readability === "number"
  );
}

function isJobMatchLike(
  value: unknown,
): value is JobMatchLike {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.score === "number"
  );
}

export function normalizeResumeAnalysisResult(
  value: unknown,
): unknown {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return value;
  }

  const result: AnalysisResultLike = {
    ...(value as Record<string, unknown>),
  };

  if (isAnalysisScores(result.scores)) {
    result.baseResumeScore =
      Object.values(
        result.scores,
      ).reduce(
        (sum, score) => sum + score,
        0,
      );
  }

  if (result.jobMatch === null) {
    result.jobMatchScore = null;
  } else if (
    isJobMatchLike(result.jobMatch)
  ) {
    result.jobMatchScore =
      result.jobMatch.score;
  }

  return result;
}