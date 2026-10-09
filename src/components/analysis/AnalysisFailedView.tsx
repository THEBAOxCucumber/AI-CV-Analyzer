import {
  XCircle,
} from "lucide-react"

import {
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import {
  retryAnalysis,
} from "../../services/analysis.service"

import {
  ApiError,
} from "../../services/api"

import type {
  ResumeAnalysisRun,
} from "../../types/analysis"

import {
  AnalysisHeader,
} from "./AnalysisResultParts"

/*
 * ข้อความตาม errorCode (fallback เป็น errorMessage จาก backend)
 */
const FAILURE_COPY: Record<
  string,
  {
    title: string
    message: string
    useServerMessage: boolean
  }
> = {
  LLM_UNAVAILABLE: {
    title: "ระบบ AI ไม่พร้อมให้บริการชั่วคราว",
    message: "กรุณาลองวิเคราะห์อีกครั้งในภายหลัง",
    useServerMessage: true,
  },
  LLM_TIMEOUT: {
    title: "การวิเคราะห์ใช้เวลานานเกินไป",
    message: "กรุณาลองวิเคราะห์อีกครั้ง",
    useServerMessage: true,
  },
  /*
   * run เก่าก่อนย้ายไป Ollama
   */
  GEMINI_UNAVAILABLE: {
    title: "ระบบ AI ไม่พร้อมให้บริการชั่วคราว",
    message:
      "ผู้ให้บริการ AI กำลังมีคำขอจำนวนมาก กรุณารอสักครู่แล้วลองวิเคราะห์อีกครั้ง",
    useServerMessage: false,
  },
  GEMINI_RATE_LIMITED: {
    title: "มีคำขอวิเคราะห์จำนวนมาก",
    message: "กรุณารอสักครู่แล้วลองใหม่อีกครั้ง",
    useServerMessage: true,
  },
  ANALYSIS_RETRY_EXHAUSTED: {
    title: "การวิเคราะห์ยังไม่สำเร็จ",
    message:
      "เกิดปัญหาชั่วคราวระหว่างการวิเคราะห์ กรุณาลองใหม่อีกครั้ง",
    useServerMessage: true,
  },
  NON_RETRYABLE_ANALYSIS_ERROR: {
    title: "ไม่สามารถวิเคราะห์ Resume ได้",
    message:
      "กรุณาตรวจสอบข้อมูลแล้วลองใหม่อีกครั้ง",
    useServerMessage: true,
  },
}

const DEFAULT_FAILURE_COPY = {
  title: "วิเคราะห์ไม่สำเร็จ",
  message:
    "ระบบไม่สามารถวิเคราะห์ได้ในขณะนี้ กรุณาลองใหม่อีกครั้ง",
  useServerMessage: true,
}

function getAnalysisFailureMessage(
  analysis: ResumeAnalysisRun,
): {
  title: string
  message: string
} {
  const copy =
    (analysis.errorCode &&
      FAILURE_COPY[analysis.errorCode]) ||
    DEFAULT_FAILURE_COPY

  return {
    title: copy.title,
    message:
      (copy.useServerMessage &&
        analysis.errorMessage) ||
      copy.message,
  }
}

export function AnalysisFailedView({
  analysis,
}: {
  analysis: ResumeAnalysisRun
}) {
  const navigate = useNavigate()

  const [isRetrying, setIsRetrying] =
    useState(false)

  const [retryError, setRetryError] =
    useState("")

  const failure =
    getAnalysisFailureMessage(analysis)

  async function handleRetry() {
    try {
      setIsRetrying(true)
      setRetryError("")

      const response =
        await retryAnalysis(analysis)

      navigate(
        `/analyses/${response.data.analysisRun.id}`,
        {
          replace: true,
        },
      )
    } catch (retryAnalysisError) {
      setRetryError(
        retryAnalysisError instanceof ApiError
          ? retryAnalysisError.message
          : "ไม่สามารถเริ่มการวิเคราะห์ใหม่ได้",
      )
    } finally {
      setIsRetrying(false)
    }
  }

  return (
    <main className="analysis-page">
      <AnalysisHeader
        eyebrow="AI Resume Analysis"
        title="Analysis Result"
        status="FAILED"
      />

      <section className="analysis-state analysis-state--error">
        <XCircle size={38} />

        <h2>{failure.title}</h2>

        <p>{failure.message}</p>

        {retryError && (
          <p
            className="analysis-retry-error"
            role="alert"
          >
            {retryError}
          </p>
        )}

        <button
          type="button"
          className="analysis-retry-button"
          disabled={isRetrying}
          onClick={() => {
            void handleRetry()
          }}
        >
          {isRetrying
            ? "กำลังเริ่มวิเคราะห์..."
            : "ลองวิเคราะห์อีกครั้ง"}
        </button>
      </section>
    </main>
  )
}
