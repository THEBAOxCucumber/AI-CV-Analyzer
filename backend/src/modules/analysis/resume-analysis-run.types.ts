export type ResumeAnalysisType =
  | "BASE"
  | "JOB_MATCH"
  | "COMBINED";

export type ResumeAnalysisStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface CreateAnalysisRunInput {
  resumeId: number;
  userId: number;
  analysisType: ResumeAnalysisType;

  jobDescriptionId:
    | number
    | null;

  promptVersion: string;
}

export interface ResumeAnalysisScores {
  contactInformation: number;
  professionalSummary: number;
  skills: number;
  experience: number;
  projects: number;
  education: number;
  readability: number;
}

export interface ResumeJobMatchResult {
  score: number;
  matchedSkills: string[];
  missingSkills: string[];
  keywordMatches: string[];
}

export interface ResumeAnalysisResult {
  baseResumeScore: number;

  jobMatchScore: number | null;

  scores: ResumeAnalysisScores;

  jobMatch: ResumeJobMatchResult | null;

  summary: string;
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
}

export interface AnalysisJobSummary {
  id: number;
  title: string;
  company: string | null;
  location: string | null;
  source: string | null;
  sourceUrl: string | null;
}

export interface ResumeAnalysisRunRecord {
  id: number
  resumeId: number
  userId: number

  jobDescriptionId:
    | number
    | null

  analysisType: ResumeAnalysisType
  status: ResumeAnalysisStatus

  baseResumeScore: number | null
  jobMatchScore: number | null

  scores:
    | ResumeAnalysisScores
    | null

  jobMatch:
    | ResumeJobMatchResult
    | null

  job: AnalysisJobSummary | null;

  summary: string | null
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]

  

  promptVersion: string
  model: string | null
  attemptCount: number

  errorCode: string | null
  errorMessage: string | null

  createdAt: Date
  updatedAt: Date
}