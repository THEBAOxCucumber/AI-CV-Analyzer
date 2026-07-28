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
  createdAt: Date;
  updatedAt: Date;
}

export interface ChunkOptions {
  maxCharacters?: number;
  overlapCharacters?: number;
}