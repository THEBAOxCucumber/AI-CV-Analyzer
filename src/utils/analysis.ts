import type {
  ResumeAnalysisRun,
} from "../types/analysis"

export function getAnalysisTypeLabel(
  type: ResumeAnalysisRun["analysisType"],
): string {
  switch (type) {
    case "BASE":
      return "Resume Analysis"

    case "JOB_MATCH":
      return "Job Match"

    case "COMBINED":
      return "Combined"

    default:
      return type
  }
}

/*
 * คะแนนหลักของ Analysis
 * JOB_MATCH → Match Score
 * อื่นๆ     → Base Resume Score
 */
export function getAnalysisScore(
  analysis: ResumeAnalysisRun,
): number | null {
  if (
    analysis.analysisType ===
    "JOB_MATCH"
  ) {
    return analysis.jobMatchScore
  }

  return analysis.baseResumeScore
}
