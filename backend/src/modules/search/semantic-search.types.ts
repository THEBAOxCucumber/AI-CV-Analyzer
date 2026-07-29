import type {
  ResumeSection,
} from "../resume/resume-chunk.types.js";

export interface SemanticSearchInput {
  userId: number;
  resumeId: number;
  query: string;
  limit?: number;
  scoreThreshold?: number;
}

export interface SemanticSearchResult {
  pointId: string | number;
  chunkId: number;
  resumeId: number;
  userId: number;
  section: ResumeSection;
  chunkIndex: number;
  content: string;
  score: number;
  embeddingModel: string | null;
}

export interface ResumeQuestionInput {
  userId: number;
  resumeId: number;
  question: string;
  limit?: number;
}

export interface ResumeEvidence {
  chunkId: number;
  chunkIndex: number;
  section: ResumeSection;
  score: number;
  content: string;
}

export interface ResumeQuestionAnswer {
  resumeId: number;
  question: string;
  answer: string;
  hasRelevantEvidence: boolean;
  evidence: ResumeEvidence[];
}