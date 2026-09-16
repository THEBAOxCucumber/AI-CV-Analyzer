import {
  apiRequest,
} from "./api"

import type {
  ApiResponse,
} from "../types/auth"

import type {
  Resume,
} from "../types/resume"

export function getResumes(): Promise<
  ApiResponse<{
    resumes: Resume[]
  }>
> {
  return apiRequest<
    ApiResponse<{
      resumes: Resume[]
    }>
  >("/resumes")
}

export function uploadResume(
  file: File,
): Promise<
  ApiResponse<{
    resume: Resume
  }>
> {
  const formData =
    new FormData()

  formData.append(
    "resume",
    file,
  )

  return apiRequest<
    ApiResponse<{
      resume: Resume
    }>
  >(
    "/resumes/upload",
    {
      method: "POST",
      body: formData,
    },
  )
}