import type { RowDataPacket } from "mysql2";

export type ResumeSection =
  | "SUMMARY"
  | "CONTACT"
  | "SKILLS"
  | "EDUCATION"
  | "EXPERIENCE"
  | "PROJECTS"
  | "CERTIFICATIONS"
  | "LANGUAGES"
  | "ACTIVITIES"
  | "GENERAL";

export type EmbeddingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ResumeChunkRow extends RowDataPacket {
  id: number;
  resume_id: number;
  user_id: number;
  section: ResumeSection;
  chunk_index: number;
  content: string;
  character_count: number;
  embedding_status: EmbeddingStatus;
  
  vector_point_id: string | null;
  embedding_model: string | null;
  embedding_dimensions: number | null;
  embedding_error: string | null;
  embedded_at: Date | null;

  created_at: Date;
  updated_at: Date;
}

export interface CreateResumeChunkInput {
  resumeId: number;
  userId: number;
  section: ResumeSection;
  chunkIndex: number;
  content: string;
  characterCount: number;
}

export interface GeneratedResumeChunk {
  section: ResumeSection;
  chunkIndex: number;
  content: string;
  characterCount: number;
}

export interface ResumeChunk {
  id: number;
  resumeId: number;
  userId: number;
  section: ResumeSection;
  chunkIndex: number;
  content: string;
  characterCount: number;
  embeddingStatus: EmbeddingStatus;

  vectorPointId: string | null;
  embeddingModel: string | null;
  embeddingDimensions: number | null;
  embeddingError: string | null;
  embeddedAt: Date | null;

  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkOptions {
  maxCharacters?: number;
  overlapCharacters?: number;
}

export interface PendingResumeChunk {
  id: number;
  resumeId: number;
  userId: number;
  section: ResumeSection;
  chunkIndex: number;
  content: string;
}