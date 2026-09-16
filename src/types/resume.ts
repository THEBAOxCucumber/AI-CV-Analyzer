export type ResumeStatus =
  | "UPLOADED"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"

export type ExtractionStatus =
  | "PENDING"
  | "COMPLETED"
  | "EMPTY"
  | "FAILED"

export type ChunkingStatus =
  | "PENDING"
  | "PROCESSING"
  | "COMPLETED"
  | "FAILED"

export interface Resume {
  id: number
  userId: number
  originalName: string
  storedName: string
  filePath: string
  mimeType: string
  fileSize: number

  pageCount: number | null
  characterCount: number
  extractionStatus: ExtractionStatus

  status: ResumeStatus

  createdAt?: string
  updatedAt?: string

  chunkingStatus: ChunkingStatus
  chunkCount: number
  chunkingError?: string | null
}