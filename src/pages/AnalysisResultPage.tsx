import {
    CheckCircle2,
    Clock3,
    Lightbulb,
    LoaderCircle,
    Sparkles,
    ThumbsDown,
    ThumbsUp,
    XCircle,
} from "lucide-react"

import {
    useEffect,
    useState,
} from "react"

import {
    useNavigate,
    useParams,
} from "react-router-dom"

import {
    getAnalysisRun,
    retryAnalysis,
} from "../services/analysis.service"

import {
    ApiError,
} from "../services/api"

import type {
    ResumeAnalysisRun,
} from "../types/analysis"

import "../styles/pages/AnalysisResultPage.css"

const POLL_INTERVAL_MS = 2000


function isPending(
    status: ResumeAnalysisRun["status"],
): boolean {
    return (
        status === "PENDING" ||
        status === "QUEUED" ||
        status === "PROCESSING"
    )
}

export function AnalysisResultPage() {
    const navigate = useNavigate()

    const { analysisRunId } =
        useParams()

    const analysisId =
        Number(analysisRunId)

    const isValidAnalysisId =
        Number.isInteger(analysisId) &&
        analysisId > 0

    const [analysis, setAnalysis] =
        useState<ResumeAnalysisRun | null>(
            null,
        )

    const [
        isRetrying,
        setIsRetrying,
    ] = useState(false)

    const [
        retryError,
        setRetryError,
    ] = useState("")

    const [error, setError] =
        useState("")

    const [isLoading, setIsLoading] =
        useState(true)

    useEffect(() => {
        if (!isValidAnalysisId) {
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

                if (isPending(run.status)) {
                    timeoutId =
                        setTimeout(
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

                if (
                    loadError instanceof ApiError
                ) {
                    setError(
                        loadError.message,
                    )
                } else {
                    setError(
                        "ไม่สามารถโหลดผลการวิเคราะห์ได้",
                    )
                }
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
        isValidAnalysisId,
    ])



    if (!isValidAnalysisId) {
        return (
            <main className="analysis-page">
                <div className="analysis-state analysis-state--error">
                    <XCircle size={36} />

                    <h1>
                        ไม่สามารถแสดงผลได้
                    </h1>

                    <p>
                        Analysis ID ไม่ถูกต้อง
                    </p>
                </div>
            </main>
        )
    }

    async function handleRetry() {
        if (!analysis) {
            return
        }

        try {
            setIsRetrying(true)
            setRetryError("")

            const response =
                await retryAnalysis(
                    analysis,
                )

            navigate(
                `/analyses/${response.data.analysisRun.id}`,
                {
                    replace: true,
                },
            )
        } catch (retryAnalysisError) {
            if (
                retryAnalysisError instanceof
                ApiError
            ) {
                setRetryError(
                    retryAnalysisError.message,
                )
            } else {
                setRetryError(
                    "ไม่สามารถเริ่มการวิเคราะห์ใหม่ได้",
                )
            }
        } finally {
            setIsRetrying(false)
        }
    }

    if (isLoading) {
        return (
            <main className="analysis-page">
                <div className="analysis-state">
                    <LoaderCircle
                        className="analysis-spinner"
                        size={36}
                    />

                    <h1>
                        กำลังโหลด Analysis
                    </h1>
                </div>
            </main>
        )
    }

    if (error) {
        return (
            <main className="analysis-page">
                <div className="analysis-state analysis-state--error">
                    <XCircle size={36} />

                    <h1>
                        ไม่สามารถแสดงผลได้
                    </h1>

                    <p>{error}</p>
                </div>
            </main>
        )
    }

    if (!analysis) {
        return null
    }

    if (isPending(analysis.status)) {
        return (
            <main className="analysis-page">
                <header className="analysis-header">
                    <div>
                        <p className="analysis-eyebrow">
                            AI Resume Analysis
                        </p>

                        <h1>
                            Analysis Result
                        </h1>
                    </div>

                    <span
                        className={`analysis-status analysis-status--${analysis.status.toLowerCase()}`}
                    >
                        {analysis.status}
                    </span>
                </header>

                <section className="analysis-state">
                    {analysis.status ===
                        "QUEUED" ? (
                        <Clock3 size={36} />
                    ) : (
                        <LoaderCircle
                            className="analysis-spinner"
                            size={36}
                        />
                    )}

                    <h2>
                        {analysis.status ===
                            "QUEUED"
                            ? "กำลังรอคิววิเคราะห์"
                            : "AI กำลังวิเคราะห์ Resume"}
                    </h2>

                    <p>
                        ระบบจะอัปเดตผลให้อัตโนมัติ
                        ไม่จำเป็นต้องรีเฟรชหน้า
                    </p>
                </section>
            </main>
        )
    }

    if (analysis.status === "FAILED") {
        return (
            <main className="analysis-page">
                <header className="analysis-header">
                    <div>
                        <p className="analysis-eyebrow">
                            AI Resume Analysis
                        </p>

                        <h1>
                            Analysis Result
                        </h1>
                    </div>

                    <span className="analysis-status analysis-status--failed">
                        FAILED
                    </span>
                </header>

                <section className="analysis-state analysis-state--error">
                    <XCircle size={38} />

                    <h2>
                        วิเคราะห์ไม่สำเร็จ
                    </h2>

                    <p>
                        ระบบไม่สามารถวิเคราะห์ได้ในขณะนี้
                        กรุณาลองใหม่อีกครั้ง
                    </p>

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
                            : "Retry Analysis"}
                    </button>
                </section>
            </main>
        )
    }

    if (
    analysis.status === "COMPLETED" &&
    analysis.analysisType === "JOB_MATCH"
) {
    const jobMatch =
        analysis.jobMatch

    const matchScore =
        analysis.jobMatchScore ??
        jobMatch?.score ??
        null

    return (
        <main className="analysis-page">
            <header className="analysis-header">
                <div>
                    <p className="analysis-eyebrow">
                        Job Match Analysis
                    </p>

                    <h1>
                        {analysis.job?.title ??
                            "Job Match Result"}
                    </h1>

                    <p className="analysis-header__description">
                        {analysis.job?.company ??
                            "ไม่ระบุบริษัท"}

                        {analysis.job?.location
                            ? ` · ${analysis.job.location}`
                            : ""}
                    </p>
                </div>

                <span className="analysis-status analysis-status--completed">
                    <CheckCircle2 size={15} />
                    COMPLETED
                </span>
            </header>

            <section className="job-match-overview">
                <div className="job-match-score-card">
                    <div className="job-match-score-card__top">
                        <div>
                            <p>
                                Match Score
                            </p>

                            <strong>
                                {matchScore ??
                                    "—"}

                                {matchScore !==
                                    null && (
                                    <span>
                                        /100
                                    </span>
                                )}
                            </strong>
                        </div>

                        <Sparkles size={26} />
                    </div>

                    {matchScore !== null && (
                        <div
                            className="job-match-progress"
                            role="progressbar"
                            aria-label="Job Match Score"
                            aria-valuenow={
                                matchScore
                            }
                            aria-valuemin={0}
                            aria-valuemax={100}
                        >
                            <div
                                className="job-match-progress__bar"
                                style={{
                                    width: `${Math.min(
                                        100,
                                        Math.max(
                                            0,
                                            matchScore,
                                        ),
                                    )}%`,
                                }}
                            />
                        </div>
                    )}
                </div>

                <div className="analysis-summary-card">
                    <h2>
                        Why this job matches you
                    </h2>

                    <p>
                        {analysis.summary ||
                            "ไม่มี Summary สำหรับการวิเคราะห์นี้"}
                    </p>
                </div>
            </section>

            <section className="analysis-section">
                <div className="analysis-section__heading">
                    <h2>
                        Skills Match
                    </h2>

                    <p>
                        เปรียบเทียบทักษะใน Resume
                        กับตำแหน่งงานนี้
                    </p>
                </div>

                <div className="job-match-skills-grid">
                    <article className="job-match-skills-card">
                        <div className="job-match-skills-card__heading">
                            <ThumbsUp size={20} />

                            <h3>
                                Matching Skills
                            </h3>
                        </div>

                        {jobMatch &&
                        jobMatch.matchedSkills
                            .length > 0 ? (
                            <div className="job-match-tags">
                                {jobMatch.matchedSkills.map(
                                    (skill) => (
                                        <span
                                            className="job-match-tag job-match-tag--matched"
                                            key={skill}
                                        >
                                            {skill}
                                        </span>
                                    ),
                                )}
                            </div>
                        ) : (
                            <p className="analysis-empty">
                                ไม่พบ Matching Skills
                            </p>
                        )}
                    </article>

                    <article className="job-match-skills-card">
                        <div className="job-match-skills-card__heading">
                            <ThumbsDown size={20} />

                            <h3>
                                Missing Skills
                            </h3>
                        </div>

                        {jobMatch &&
                        jobMatch.missingSkills
                            .length > 0 ? (
                            <div className="job-match-tags">
                                {jobMatch.missingSkills.map(
                                    (skill) => (
                                        <span
                                            className="job-match-tag job-match-tag--missing"
                                            key={skill}
                                        >
                                            {skill}
                                        </span>
                                    ),
                                )}
                            </div>
                        ) : (
                            <p className="analysis-empty">
                                ไม่พบ Missing Skills
                            </p>
                        )}
                    </article>
                </div>
            </section>

            <section className="analysis-section">
                <div className="analysis-section__heading">
                    <h2>
                        Keyword Matches
                    </h2>

                    <p>
                        Keywords ที่พบทั้งใน Resume
                        และ Job Description
                    </p>
                </div>

                {jobMatch &&
                jobMatch.keywordMatches.length >
                    0 ? (
                    <div className="job-match-tags">
                        {jobMatch.keywordMatches.map(
                            (keyword) => (
                                <span
                                    className="job-match-tag"
                                    key={keyword}
                                >
                                    {keyword}
                                </span>
                            ),
                        )}
                    </div>
                ) : (
                    <p className="analysis-empty">
                        ไม่พบ Keyword Matches
                    </p>
                )}
            </section>

            <section className="recommendations-card">
                <div className="recommendations-card__heading">
                    <Lightbulb size={23} />

                    <div>
                        <h2>
                            Recommendations
                        </h2>

                        <p>
                            แนวทางเพิ่มความเหมาะสม
                            กับตำแหน่งงานนี้
                        </p>
                    </div>
                </div>

                {analysis.recommendations
                    .length > 0 ? (
                    <ol>
                        {analysis.recommendations.map(
                            (
                                recommendation,
                                index,
                            ) => (
                                <li
                                    key={`${index}-${recommendation}`}
                                >
                                    <span>
                                        {index +
                                            1}
                                    </span>

                                    <p>
                                        {
                                            recommendation
                                        }
                                    </p>
                                </li>
                            ),
                        )}
                    </ol>
                ) : (
                    <p className="analysis-empty">
                        ไม่มี Recommendations
                    </p>
                )}
            </section>

            {analysis.job?.sourceUrl && (
                <div className="job-match-source">
                    <a
                        href={
                            analysis.job
                                .sourceUrl
                        }
                        target="_blank"
                        rel="noreferrer"
                    >
                        View Original Job
                    </a>
                </div>
            )}
        </main>
    )
}
    
    const sectionScores = analysis.scores
        ? [
            {
                label: "Contact Information",
                score: analysis.scores.contactInformation,
                maxScore: 10,
            },
            {
                label: "Professional Summary",
                score: analysis.scores.professionalSummary,
                maxScore: 15,
            },
            {
                label: "Skills",
                score: analysis.scores.skills,
                maxScore: 20,
            },
            {
                label: "Experience",
                score: analysis.scores.experience,
                maxScore: 25,
            },
            {
                label: "Projects",
                score: analysis.scores.projects,
                maxScore: 10,
            },
            {
                label: "Education",
                score: analysis.scores.education,
                maxScore: 10,
            },
            {
                label: "Readability",
                score: analysis.scores.readability,
                maxScore: 10,
            },
        ]
        : []


    return (
        <main className="analysis-page">
            <header className="analysis-header">
                <div>
                    <p className="analysis-eyebrow">
                        AI Resume Analysis
                    </p>

                    <h1>
                        Analysis Result
                    </h1>

                    <p className="analysis-header__description">
                        ผลการวิเคราะห์ Resume
                        และข้อเสนอแนะจาก AI
                    </p>
                </div>

                <span className="analysis-status analysis-status--completed">
                    <CheckCircle2 size={15} />
                    COMPLETED
                </span>
            </header>

            <section className="analysis-overview">
                <div className="base-score-card">
                    <div className="base-score-card__label">
                        <Sparkles size={20} />

                        <span>
                            Base Resume Score
                        </span>
                    </div>

                    <div className="base-score-card__score">
                        <strong>
                            {analysis.baseResumeScore ??
                                "—"}
                        </strong>

                        {analysis.baseResumeScore !==
                            null && <span>/100</span>}
                    </div>

                    <p>
                        คะแนนภาพรวมของ Resume
                        จากโครงสร้างและเนื้อหา
                    </p>
                </div>

                <div className="analysis-summary-card">
                    <h2>
                        Summary
                    </h2>

                    <p>
                        {analysis.summary ||
                            "ไม่มี Summary สำหรับการวิเคราะห์นี้"}
                    </p>
                </div>
            </section>

            <section className="analysis-section">
                <div className="analysis-section__heading">
                    <h2>
                        Section Scores
                    </h2>

                    <p>
                        คะแนนแยกตามองค์ประกอบของ Resume
                    </p>
                </div>

                {sectionScores.length > 0 ? (
                    <div className="section-scores">
                        {sectionScores.map(
                            ({
                                label,
                                score,
                                maxScore,
                            }) => {
                                const percentage =
                                    Math.min(
                                        100,
                                        Math.max(
                                            0,
                                            (score / maxScore) * 100,
                                        ),
                                    )

                                return (
                                    <div
                                        className="section-score-card"
                                        key={label}
                                    >
                                        <div className="section-score-card__top">
                                            <span>{label}</span>

                                            <strong>
                                                {score}
                                                <span className="section-score-card__max">
                                                    /{maxScore}
                                                </span>
                                            </strong>
                                        </div>

                                        <div
                                            className="score-progress"
                                            role="progressbar"
                                            aria-label={label}
                                            aria-valuenow={score}
                                            aria-valuemin={0}
                                            aria-valuemax={maxScore}
                                        >
                                            <div
                                                className="score-progress__bar"
                                                style={{
                                                    width: `${percentage}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            },
                        )}
                    </div>
                ) : (
                    <p className="analysis-empty">
                        ไม่มีข้อมูล Section Scores
                    </p>
                )}
            </section>

            <section className="analysis-feedback-grid">
                <article className="feedback-card">
                    <div className="feedback-card__heading feedback-card__heading--strength">
                        <ThumbsUp size={21} />

                        <h2>
                            Strengths
                        </h2>
                    </div>

                    {analysis.strengths.length >
                        0 ? (
                        <ul>
                            {analysis.strengths.map(
                                (strength, index) => (
                                    <li
                                        key={`${index}-${strength}`}
                                    >
                                        {strength}
                                    </li>
                                ),
                            )}
                        </ul>
                    ) : (
                        <p className="analysis-empty">
                            ไม่มีข้อมูล Strengths
                        </p>
                    )}
                </article>

                <article className="feedback-card">
                    <div className="feedback-card__heading feedback-card__heading--weakness">
                        <ThumbsDown size={21} />

                        <h2>
                            Weaknesses
                        </h2>
                    </div>

                    {analysis.weaknesses.length >
                        0 ? (
                        <ul>
                            {analysis.weaknesses.map(
                                (weakness, index) => (
                                    <li
                                        key={`${index}-${weakness}`}
                                    >
                                        {weakness}
                                    </li>
                                ),
                            )}
                        </ul>
                    ) : (
                        <p className="analysis-empty">
                            ไม่มีข้อมูล Weaknesses
                        </p>
                    )}
                </article>
            </section>

            <section className="recommendations-card">
                <div className="recommendations-card__heading">
                    <Lightbulb size={23} />

                    <div>
                        <h2>
                            Recommendations
                        </h2>

                        <p>
                            แนวทางที่ช่วยปรับปรุง Resume
                        </p>
                    </div>
                </div>

                {analysis.recommendations.length >
                    0 ? (
                    <ol>
                        {analysis.recommendations.map(
                            (
                                recommendation,
                                index,
                            ) => (
                                <li
                                    key={`${index}-${recommendation}`}
                                >
                                    <span>
                                        {index + 1}
                                    </span>

                                    <p>
                                        {recommendation}
                                    </p>
                                </li>
                            ),
                        )}
                    </ol>
                ) : (
                    <p className="analysis-empty">
                        ไม่มี Recommendations
                    </p>
                )}
            </section>
        </main>
    )
}


