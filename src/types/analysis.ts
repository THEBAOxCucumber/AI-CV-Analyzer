export type ResumeAnalysisType =
  | "BASE"
  | "JOB_MATCH"
  | "COMBINED"

export type ResumeAnalysisStatus =
  | "PENDING"
  | "QUEUED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"

export interface ResumeAnalysisScores {
  contactInformation: number
  professionalSummary: number
  skills: number
  experience: number
  projects: number
  education: number
  readability: number
}

export interface ResumeJobMatchResult {
  score: number
  matchedSkills: string[]
  missingSkills: string[]
  keywordMatches: string[]
}

export interface AnalysisJobSummary {
  id: number
  title: string
  company: string | null
  location: string | null
  source: string | null
  sourceUrl: string | null
}

export interface ResumeAnalysisRun {
  id: number
  resumeId: number
  userId: number

  jobDescriptionId: number | null
  job: AnalysisJobSummary | null

  analysisType: ResumeAnalysisType
  status: ResumeAnalysisStatus

  baseResumeScore: number | null
  jobMatchScore: number | null

  scores: ResumeAnalysisScores | null
  jobMatch: ResumeJobMatchResult | null
  
  summary: string | null
  
  strengths: string[]
  weaknesses: string[]
  recommendations: string[]

  promptVersion: string
  model: string | null
  attemptCount: number

  errorCode: string | null
  errorMessage: string | null

  createdAt: string
  updatedAt: string
}