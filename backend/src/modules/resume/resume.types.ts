import type { RowDataPacket } from "mysql2";

export type ResumeStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export type ExtractionStatus =
  | "PENDING"
  | "COMPLETED"
  | "EMPTY"
  | "FAILED";

  export type ChunkingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED";

export interface ResumeRow extends RowDataPacket {
  id: number;
  user_id: number;
  original_name: string;
  stored_name: string;
  file_path: string;
  mime_type: string;
  file_size: number;

  extracted_text: string | null;
  page_count: number | null;
  character_count: number;
  extraction_status: ExtractionStatus;
  extraction_error: string | null;

  status: ResumeStatus;
  created_at: Date;
  updated_at: Date;

  chunking_status: ChunkingStatus;
chunk_count: number;
chunking_error: string | null;
}

export interface CreateResumeInput {
  userId: number;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;
}

export interface Resume {
  id: number;
  userId: number;
  originalName: string;
  storedName: string;
  filePath: string;
  mimeType: string;
  fileSize: number;

  extractedText?: string | null;
  pageCount: number | null;
  characterCount: number;
  extractionStatus: ExtractionStatus;
  extractionError?: string | null;

  status: ResumeStatus;
  createdAt?: Date;
  updatedAt?: Date;

  chunkingStatus: ChunkingStatus;
chunkCount: number;
chunkingError?: string | null;
}

export interface PdfExtractionResult {
  text: string;
  pageCount: number;
  characterCount: number;
}

