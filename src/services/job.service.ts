import {
  apiRequest,
} from "./api"

import type {
  ApiResponse,
} from "../types/auth"

import type {
  JobSearchResult,
} from "../types/job"

import type {
  JobDescription,
} from "../types/job-description"


export interface SearchJobsInput {
  keywords: string
  location?: string
  page?: number
  pageSize?: number
}

export function searchJobs(
  input: SearchJobsInput,
): Promise<
  ApiResponse<JobSearchResult>
> {
  const params =
    new URLSearchParams({
      keywords: input.keywords,
      location:
        input.location ?? "Thailand",
      page:
        String(input.page ?? 1),
      pageSize:
        String(input.pageSize ?? 10),
    })

  return apiRequest<
    ApiResponse<JobSearchResult>
  >(
    `/jobs?${params.toString()}`,
  )
}

export interface ImportJobInput {
  externalJobId: string
  title: string
  company: string | null
  description: string
  location: string
  salary: string | null
  postedAt: string | null
  sourceUrl: string
  source: "CAREERJET"
}

export function importJob(
  input: ImportJobInput,
): Promise<
  ApiResponse<{
    jobDescription: JobDescription
  }>
> {
  return apiRequest<
    ApiResponse<{
      jobDescription: JobDescription
    }>
  >(
    "/jobs/import",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}