import { apiRequest } from "./api"
import type { ApiResponse } from "../types/auth"
import type {
  CreateJobDescriptionInput,
  JobDescription,
} from "../types/job-description"

export function createJobDescription(
  input: CreateJobDescriptionInput,
): Promise<
  ApiResponse<{
    jobDescription: JobDescription
  }>
> {
  return apiRequest<
    ApiResponse<{
      jobDescription: JobDescription
    }>
  >("/job-descriptions", {
    method: "POST",
    body: JSON.stringify(input),
  })
}