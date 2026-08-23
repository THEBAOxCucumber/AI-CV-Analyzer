export interface ResumeAnalysisJobData {
  analysisRunId: number;
  resumeId: number;
  userId: number;
  jobDescriptionId: number | null;

  analysisType:
    | "BASE"
    | "JOB_MATCH"
    | "COMBINED";

  promptVersion: string;
}