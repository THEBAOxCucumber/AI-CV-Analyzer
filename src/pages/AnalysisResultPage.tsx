import {
    useParams,
} from "react-router-dom"

import {
    isPendingAnalysis,
    useAnalysisRun,
} from "../hooks/useAnalysisRun"

import {
    AnalysisProgress,
} from "../components/analysis/AnalysisProgress"

import {
    AnalysisFailedView,
} from "../components/analysis/AnalysisFailedView"

import {
    AnalysisStateMessage,
} from "../components/analysis/AnalysisResultParts"

import {
    BaseResultView,
} from "../components/analysis/BaseResultView"

import {
    JobMatchResultView,
} from "../components/analysis/JobMatchResultView"

import "../styles/pages/AnalysisResultPage.css"

/*
 * เลือก view ตามสถานะ:
 * โหลด → error → กำลังวิเคราะห์ → ล้มเหลว → Job Match / Base
 */
export function AnalysisResultPage() {
    const { analysisRunId } =
        useParams()

    const analysisId =
        Number(analysisRunId)

    const isValidAnalysisId =
        Number.isInteger(analysisId) &&
        analysisId > 0

    const {
        analysis,
        error,
        isLoading,
    } = useAnalysisRun(
        analysisId,
        isValidAnalysisId,
    )

    if (!isValidAnalysisId) {
        return (
            <AnalysisStateMessage
                title="ไม่สามารถแสดงผลได้"
                message="Analysis ID ไม่ถูกต้อง"
            />
        )
    }

    if (isLoading) {
        return (
            <AnalysisStateMessage
                title="กำลังโหลด Analysis"
                isLoading
            />
        )
    }

    if (error) {
        return (
            <AnalysisStateMessage
                title="ไม่สามารถแสดงผลได้"
                message={error}
            />
        )
    }

    if (!analysis) {
        return null
    }

    if (isPendingAnalysis(analysis.status)) {
        return (
            <main className="analysis-page">
                <AnalysisProgress
                    analysis={analysis}
                />
            </main>
        )
    }

    if (analysis.status === "FAILED") {
        return (
            <AnalysisFailedView
                analysis={analysis}
            />
        )
    }

    if (analysis.analysisType === "JOB_MATCH") {
        return (
            <JobMatchResultView
                analysis={analysis}
            />
        )
    }

    return (
        <BaseResultView
            analysis={analysis}
        />
    )
}
