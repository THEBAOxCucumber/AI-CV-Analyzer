export type ResumeAnalysisStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ResumeAnalysisScores {
  contactInformation: number;
  professionalSummary: number;
  skills: number;
  experience: number;
  projects: number;
  education: number;
  readability: number;
  jobRelevance: number;
}

export interface ResumeAnalysisResult {
  overallScore: number;
  scores: ResumeAnalysisScores;
  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface AnalyzeResumeInput {
  resumeId: number;
  userId: number;
  force?: boolean;
}

export interface ResumeAnalysisRecord {
  id: number;
  resumeId: number;
  userId: number;
  status: ResumeAnalysisStatus;
  overallScore: number | null;
  scores: ResumeAnalysisScores | null;
  summary: string | null;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
  model: string | null;
  promptVersion: string | null;
  errorMessage: string | null;
  analyzedAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}