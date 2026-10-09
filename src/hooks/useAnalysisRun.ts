import {
  useEffect,
  useState,
} from "react"

import {
  getAnalysisRun,
} from "../services/analysis.service"

import {
  ApiError,
} from "../services/api"

import type {
  ResumeAnalysisRun,
} from "../types/analysis"

const POLL_INTERVAL_MS = 2000

export function isPendingAnalysis(
  status: ResumeAnalysisRun["status"],
): boolean {
  return (
    status === "PENDING" ||
    status === "QUEUED" ||
    status === "PROCESSING"
  )
}

/*
 * โหลด analysis run และ poll ทุก 2 วินาทีจนกว่าจะเสร็จ/ล้มเหลว
 * analysisId ไม่ถูกต้อง → ไม่โหลด (ให้หน้าแสดง error เอง)
 */
export function useAnalysisRun(
  analysisId: number,
  enabled: boolean,
): {
  analysis: ResumeAnalysisRun | null
  error: string
  isLoading: boolean
} {
  const [analysis, setAnalysis] =
    useState<ResumeAnalysisRun | null>(
      null,
    )

  const [error, setError] =
    useState("")

  const [isLoading, setIsLoading] =
    useState(true)

  useEffect(() => {
    if (!enabled) {
      return
    }

    let cancelled = false

    let timeoutId:
      ReturnType<typeof setTimeout>
      | undefined

    async function loadAnalysis() {
      try {
        const response =
          await getAnalysisRun(
            analysisId,
          )

        if (cancelled) {
          return
        }

        const run =
          response.data.analysisRun

        setAnalysis(run)
        setError("")
        setIsLoading(false)

        if (isPendingAnalysis(run.status)) {
          timeoutId = setTimeout(
            () => {
              void loadAnalysis()
            },
            POLL_INTERVAL_MS,
          )
        }
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setIsLoading(false)
        setError(
          loadError instanceof ApiError
            ? loadError.message
            : "ไม่สามารถโหลดผลการวิเคราะห์ได้",
        )
      }
    }

    void loadAnalysis()

    return () => {
      cancelled = true

      if (timeoutId) {
        clearTimeout(timeoutId)
      }
    }
  }, [
    analysisId,
    enabled,
  ])

  return {
    analysis,
    error,
    isLoading,
  }
}
