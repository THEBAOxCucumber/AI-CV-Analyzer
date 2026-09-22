import {
  apiRequest,
} from "./api"

import type {
  ApiResponse,
} from "../types/auth"

import type {
  ResumeAnalysisRun,
} from "../types/analysis"

export function startBaseAnalysis(
  resumeId: number,
): Promise<
  ApiResponse<{
    analysisRun: ResumeAnalysisRun
  }>
> {
  return apiRequest<
    ApiResponse<{
      analysisRun: ResumeAnalysisRun
    }>
  >(
    `/resumes/${resumeId}/analyses`,
    {
      method: "POST",
      body: JSON.stringify({
        analysisType: "BASE",
      }),
    },
  )
}

export function startJobMatchAnalysis(
  resumeId: number,
  jobDescriptionId: number,
): Promise<
  ApiResponse<{
    analysisRun: ResumeAnalysisRun
  }>
> {
  return apiRequest<
    ApiResponse<{
      analysisRun: ResumeAnalysisRun
    }>
  >(`/resumes/${resumeId}/analyses`, {
    method: "POST",
    body: JSON.stringify({
      analysisType: "JOB_MATCH",
      jobDescriptionId,
    }),
  })
}

export function getAnalysisRun(
  analysisRunId: number,
): Promise<
  ApiResponse<{
    analysisRun: ResumeAnalysisRun
  }>
> {
  return apiRequest<
    ApiResponse<{
      analysisRun: ResumeAnalysisRun
    }>
  >(
    `/analyses/${analysisRunId}`,
  )
}

export function getResumeAnalysisHistory(
  resumeId: number,
  limit = 100,
): Promise<
  ApiResponse<{
    analyses: ResumeAnalysisRun[]
  }>
> {
  return apiRequest<
    ApiResponse<{
      analyses: ResumeAnalysisRun[]
    }>
  >(
    `/resumes/${resumeId}/analyses?limit=${limit}`,
  )
}

export function retryAnalysis(
  analysis: ResumeAnalysisRun,
): Promise<
  ApiResponse<{
    analysisRun: ResumeAnalysisRun
  }>
> {
  if (
    analysis.analysisType !== "BASE" &&
    analysis.jobDescriptionId === null
  ) {
    return Promise.reject(
      new Error(
        "Job description is missing for this analysis",
      ),
    )
  }

  const body =
    analysis.analysisType === "BASE"
      ? {
          analysisType:
            "BASE" as const,
        }
      : {
          analysisType:
            analysis.analysisType,
          jobDescriptionId:
            analysis.jobDescriptionId,
        }

  return apiRequest<
    ApiResponse<{
      analysisRun: ResumeAnalysisRun
    }>
  >(
    `/resumes/${analysis.resumeId}/analyses`,
    {
      method: "POST",
      body: JSON.stringify(body),
    },
  )
}

export function deleteAnalysisRun(
  analysisRunId: number,
): Promise<ApiResponse<unknown>> {
  return apiRequest<ApiResponse<unknown>>(
    `/analyses/${analysisRunId}`,
    {
      method: "DELETE",
    },
  )
}