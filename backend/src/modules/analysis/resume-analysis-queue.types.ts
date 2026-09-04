export interface ResumeAnalysisJobData {
  analysisRunId: number;
  resumeId: number;
  userId: number;
  analysisType:
    | "BASE"
    | "JOB_MATCH"
    | "COMBINED";
  jobDescriptionId:
    | number
    | null;

  promptVersion: string;
}