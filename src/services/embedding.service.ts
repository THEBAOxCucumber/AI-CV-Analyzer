import {
  apiRequest,
} from "./api"

import type {
  ApiResponse,
} from "../types/auth"

export interface EmbedResumeResult {
  resumeId: number
  processedCount: number
  remainingPendingCount: number
}

export function embedResume(
  resumeId: number,
): Promise<
  ApiResponse<EmbedResumeResult>
> {
  return apiRequest<
    ApiResponse<EmbedResumeResult>
  >(
    `/resumes/${resumeId}/embeddings`,
    {
      method: "POST",
    },
  )
}