import {
    Award,
    BarChart3,
    CheckCircle2,
    Lightbulb,
    Sparkles,
    Target,
    TrendingUp,
    TriangleAlert,
} from "lucide-react"

import {
    useEffect,
    useMemo,
    useState,
} from "react"

import {
    Link,
} from "react-router-dom"

import {
    getResumeAnalysisHistory,
} from "../services/analysis.service"

import {
    getResumes,
} from "../services/resume.service"

import type {
    ResumeAnalysisRun,
    ResumeAnalysisScores,
} from "../types/analysis"

import {
    formatThaiDateTime,
    formatThaiShortDate,
} from "../utils/date-time"

import "../styles/pages/InsightsPage.css"

const scoreLabels: Array<{
    key: keyof ResumeAnalysisScores
    label: string
    maxScore: number
}> = [
        {
            key: "contactInformation",
            label: "ข้อมูลติดต่อ",
            maxScore: 10,
        },
        {
            key: "professionalSummary",
            label: "Professional Summary",
            maxScore: 15,
        },
        {
            key: "skills",
            label: "Skills",
            maxScore: 20,
        },
        {
            key: "experience",
            label: "Experience",
            maxScore: 25,
        },
        {
            key: "projects",
            label: "Projects",
            maxScore: 10,
        },
        {
            key: "education",
            label: "Education",
            maxScore: 10,
        },
        {
            key: "readability",
            label: "Readability",
            maxScore: 10,
        },
    ]

function getTopItems(
    items: string[],
    limit = 5,
): Array<{
    text: string
    count: number
}> {
    const counts =
        new Map<string, number>()

    for (const item of items) {
        const normalized =
            item.trim()

        if (!normalized) {
            continue
        }

        counts.set(
            normalized,
            (counts.get(normalized) ?? 0) + 1,
        )
    }

    return Array.from(
        counts.entries(),
    )
        .map(([text, count]) => ({
            text,
            count,
        }))
        .sort(
            (a, b) =>
                b.count - a.count,
        )
        .slice(0, limit)
}

export function InsightsPage() {
    const [analyses, setAnalyses] =
        useState<ResumeAnalysisRun[]>([])

    const [isLoading, setIsLoading] =
        useState(true)

    const [error, setError] =
        useState("")

    useEffect(() => {
        let cancelled = false

        async function loadInsights() {
            try {
                setError("")

                const resumeResponse =
                    await getResumes()

                const resumes =
                    resumeResponse.data.resumes

                const historyResponses =
                    await Promise.all(
                        resumes.map(
                            (resume) =>
                                getResumeAnalysisHistory(
                                    resume.id,
                                    100,
                                ),
                        ),
                    )

                const loadedAnalyses =
                    historyResponses
                        .flatMap(
                            (response) =>
                                response.data.analyses,
                        )
                        .filter(
                            (analysis) =>
                                analysis.status ===
                                "COMPLETED",
                        )
                        .sort(
                            (a, b) =>
                                new Date(
                                    b.createdAt,
                                ).getTime() -
                                new Date(
                                    a.createdAt,
                                ).getTime(),
                        )

                if (!cancelled) {
                    setAnalyses(
                        loadedAnalyses,
                    )
                }
            } catch {
                if (!cancelled) {
                    setError(
                        "ไม่สามารถโหลดข้อมูล Insights ได้",
                    )
                }
            } finally {
                if (!cancelled) {
                    setIsLoading(false)
                }
            }
        }

        void loadInsights()

        return () => {
            cancelled = true
        }
    }, [])

    const baseAnalyses =
        useMemo(
            () =>
                analyses.filter(
                    (analysis) =>
                        (analysis.analysisType === "BASE" ||
                            analysis.analysisType === "COMBINED") &&
                        analysis.baseResumeScore !== null &&
                        analysis.scores !== null,
                ),
            [analyses],
        )

    const jobMatchAnalyses =
        useMemo(
            () =>
                analyses.filter(
                    (analysis) =>
                        (analysis.analysisType === "JOB_MATCH" ||
                            analysis.analysisType === "COMBINED") &&
                        analysis.jobMatchScore !== null,
                ),
            [analyses],
        )

    const latestBaseAnalysis =
        baseAnalyses[0] ?? null

    const latestScore =
        latestBaseAnalysis
            ?.baseResumeScore ?? null

    const averageScore =
        baseAnalyses.length > 0
            ? Math.round(
                baseAnalyses.reduce(
                    (sum, analysis) =>
                        sum +
                        (analysis.baseResumeScore ??
                            0),
                    0,
                ) / baseAnalyses.length,
            )
            : null

    const highestScore =
        baseAnalyses.length > 0
            ? Math.max(
                ...baseAnalyses.map(
                    (analysis) =>
                        analysis.baseResumeScore ??
                        0,
                ),
            )
            : null

    const averageJobMatch =
        jobMatchAnalyses.length > 0
            ? Math.round(
                jobMatchAnalyses.reduce(
                    (sum, analysis) =>
                        sum +
                        (analysis.jobMatchScore ??
                            0),
                    0,
                ) /
                jobMatchAnalyses.length,
            )
            : null

    const scoreTrend =
        useMemo(
            () =>
                [...baseAnalyses]
                    .sort(
                        (a, b) =>
                            new Date(
                                a.createdAt,
                            ).getTime() -
                            new Date(
                                b.createdAt,
                            ).getTime(),
                    )
                    .slice(-8),
            [baseAnalyses],
        )

    const strengths =
        useMemo(
            () =>
                getTopItems(
                    baseAnalyses.flatMap(
                        (analysis) =>
                            analysis.strengths,
                    ),
                ),
            [baseAnalyses],
        )

    const weaknesses =
        useMemo(
            () =>
                getTopItems(
                    baseAnalyses.flatMap(
                        (analysis) =>
                            analysis.weaknesses,
                    ),
                ),
            [baseAnalyses],
        )

    const recommendations =
        useMemo(
            () =>
                getTopItems(
                    baseAnalyses.flatMap(
                        (analysis) =>
                            analysis.recommendations,
                    ),
                ),
            [baseAnalyses],
        )

    if (isLoading) {
        return (
            <main className="insights">
                <div className="insights__state">
                    กำลังวิเคราะห์ข้อมูล Insights...
                </div>
            </main>
        )
    }

    if (error) {
        return (
            <main className="insights">
                <div
                    className="insights__error"
                    role="alert"
                >
                    {error}
                </div>
            </main>
        )
    }

    if (analyses.length === 0) {
        return (
            <main className="insights">
                <div className="insights__empty">
                    <div className="insights__empty-icon">
                        <BarChart3 size={32} />
                    </div>

                    <h1>
                        ยังไม่มีข้อมูล Insights
                    </h1>

                    <p>
                        วิเคราะห์ Resume
                        อย่างน้อยหนึ่งครั้ง
                        เพื่อดูข้อมูลเชิงลึก
                    </p>

                    <Link
                        to="/resumes/upload"
                        className="insights__primary-button"
                    >
                        วิเคราะห์ Resume
                    </Link>
                </div>
            </main>
        )
    }

    return (
        <main className="insights">
            <header className="insights__header">
                <div>
                    <p className="insights__eyebrow">
                        Insights
                    </p>

                    <h1>
                        Resume Insights
                    </h1>

                    <p>
                        ภาพรวมและแนวโน้มจากการวิเคราะห์
                        Resume ของคุณ
                    </p>
                </div>

                <div className="insights__analysis-count">
                    <Sparkles size={18} />

                    <span>
                        {analyses.length} Analyses
                        {" • "}
                        {baseAnalyses.length} Resume
                    </span>
                </div>
            </header>

            <section className="insights__stats">
                <article className="insight-stat">
                    <div className="insight-stat__icon">
                        <TrendingUp size={22} />
                    </div>

                    <span>
                        คะแนนล่าสุด
                    </span>

                    <strong>
                        {latestScore !== null
                            ? `${latestScore}/100`
                            : "—"}
                    </strong>
                </article>

                <article className="insight-stat">
                    <div className="insight-stat__icon">
                        <BarChart3 size={22} />
                    </div>

                    <span>
                        คะแนนเฉลี่ย
                    </span>

                    <strong>
                        {averageScore !== null
                            ? `${averageScore}/100`
                            : "—"}
                    </strong>
                </article>

                <article className="insight-stat">
                    <div className="insight-stat__icon">
                        <Award size={22} />
                    </div>

                    <span>
                        คะแนนสูงสุด
                    </span>

                    <strong>
                        {highestScore !== null
                            ? `${highestScore}/100`
                            : "—"}
                    </strong>
                </article>

                <article className="insight-stat">
                    <div className="insight-stat__icon">
                        <Target size={22} />
                    </div>

                    <span>
                        Job Match เฉลี่ย
                    </span>

                    <strong>
                        {averageJobMatch !== null
                            ? `${averageJobMatch}/100`
                            : "—"}
                    </strong>
                </article>
            </section>

            {scoreTrend.length > 0 && (
                <section className="insights__panel">
                    <div className="insights__panel-header">
                        <div>
                            <h2>
                                แนวโน้มคะแนน Resume
                            </h2>

                            <p>
                                คะแนนจากการวิเคราะห์ล่าสุด
                                เรียงตามเวลา
                            </p>

                            {scoreTrend.length < 3 && (
                                <p className="score-trend__hint">
                                    วิเคราะห์ Resume เพิ่มอีกอย่างน้อย{" "}
                                    {3 - scoreTrend.length} ครั้ง
                                    เพื่อดูแนวโน้มคะแนนได้ชัดเจนขึ้น
                                </p>
                            )}
                        </div>

                        <TrendingUp size={21} />
                    </div>

                    <div className="score-trend">
                        {scoreTrend.map(
                            (analysis) => {
                                const score =
                                    analysis.baseResumeScore ?? 0

                                return (
                                    <div
                                        key={analysis.id}
                                        className="score-trend__item"
                                        title={`${score}/100 • ${formatThaiDateTime(
                                            analysis.createdAt,
                                        )}`}
                                    >
                                        <div className="score-trend__value">
                                            {score}
                                        </div>

                                        <div className="score-trend__chart">
                                            <div
                                                className="score-trend__bar"
                                                style={{
                                                    height: `${Math.max(
                                                        4,
                                                        score,
                                                    )}%`,
                                                }}
                                            />
                                        </div>

                                        <span className="score-trend__date">
                                            {formatThaiShortDate(
                                                analysis.createdAt,
                                            )}
                                        </span>
                                    </div>
                                )
                            },
                        )}
                    </div>
                </section>
            )}

            {latestBaseAnalysis?.scores && (
                <section className="insights__panel">
                    <div className="insights__panel-header">
                        <div>
                            <h2>
                                คะแนนแต่ละด้าน
                            </h2>

                            <p>
                                ผลจาก Resume Analysis
                                ล่าสุด
                            </p>
                        </div>

                        <span>
                            {formatThaiDateTime(
                                latestBaseAnalysis.createdAt,
                            )}
                        </span>
                    </div>

                    <div className="score-breakdown">
                        {scoreLabels.map(
                            ({
                                key,
                                label,
                                maxScore,
                            }) => {
                                const score =
                                    latestBaseAnalysis
                                        .scores?.[key] ?? 0

                                return (
                                    <div
                                        key={key}
                                        className="score-breakdown__item"
                                    >
                                        <div className="score-breakdown__header">
                                            <span>
                                                {label}
                                            </span>

                                            <strong>
                                                {score}/{maxScore}
                                            </strong>
                                        </div>

                                        <div className="score-breakdown__track">
                                            <div
                                                className="score-breakdown__fill"
                                                style={{
                                                    width: `${Math.min(
                                                        100,
                                                        Math.max(
                                                            0,
                                                            (score / maxScore) * 100,
                                                        ),
                                                    )}%`,
                                                }}
                                            />
                                        </div>
                                    </div>
                                )
                            },
                        )}
                    </div>
                </section>
            )}

            <section className="insights__grid">
                <article className="insights__panel">
                    <div className="insights__panel-title">
                        <CheckCircle2 size={21} />

                        <h2>
                            จุดแข็งที่พบบ่อย
                        </h2>
                    </div>

                    {strengths.length > 0 ? (
                        <div className="insights__list">
                            {strengths.map(
                                (item) => (
                                    <div
                                        key={item.text}
                                        className="insights__list-item"
                                    >
                                        <span>
                                            {item.text}
                                        </span>

                                        {item.count > 1 && (
                                            <small>
                                                {item.count} ครั้ง
                                            </small>
                                        )}
                                    </div>
                                ),
                            )}
                        </div>
                    ) : (
                        <p className="insights__muted">
                            ยังไม่มีข้อมูล
                        </p>
                    )}
                </article>

                <article className="insights__panel">
                    <div className="insights__panel-title">
                        <TriangleAlert size={21} />

                        <h2>
                            จุดที่ควรปรับปรุง
                        </h2>
                    </div>

                    {weaknesses.length > 0 ? (
                        <div className="insights__list">
                            {weaknesses.map(
                                (item) => (
                                    <div
                                        key={item.text}
                                        className="insights__list-item"
                                    >
                                        <span>
                                            {item.text}
                                        </span>

                                        {item.count > 1 && (
                                            <small>
                                                {item.count} ครั้ง
                                            </small>
                                        )}
                                    </div>
                                ),
                            )}
                        </div>
                    ) : (
                        <p className="insights__muted">
                            ยังไม่มีข้อมูล
                        </p>
                    )}
                </article>
            </section>

            <section className="insights__panel">
                <div className="insights__panel-title">
                    <Lightbulb size={21} />

                    <h2>
                        คำแนะนำที่ควรให้ความสำคัญ
                    </h2>
                </div>

                {recommendations.length > 0 ? (
                    <div className="insights__recommendations">
                        {recommendations.map(
                            (item, index) => (
                                <div
                                    key={item.text}
                                    className="recommendation-item"
                                >
                                    <span className="recommendation-item__number">
                                        {index + 1}
                                    </span>

                                    <div>
                                        <p>
                                            {item.text}
                                        </p>

                                        {item.count > 1 && (
                                            <small>
                                                พบใน {item.count} analyses
                                            </small>
                                        )}
                                    </div>
                                </div>
                            ),
                        )}
                    </div>
                ) : (
                    <p className="insights__muted">
                        ยังไม่มีคำแนะนำ
                    </p>
                )}
            </section>
        </main>
    )
}