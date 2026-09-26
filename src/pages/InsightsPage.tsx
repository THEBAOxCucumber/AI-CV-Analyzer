import {
    ArrowDown,
    ArrowUp,
    Award,
    BarChart3,
    CheckCircle2,
    CircleAlert,
    Lightbulb,
    Minus,
    Sparkles,
    Target,
    TrendingUp,
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
} from "../types/analysis"

import {
    formatThaiDate,
    formatThaiDateTime,
    formatThaiShortDate,
} from "../utils/date-time"

import {
    getAnalysisTypeLabel,
} from "../utils/analysis"

import {
    buildSectionScores,
} from "../utils/section-scores"

import {
    ScoreTrendChart,
    type TrendPoint,
} from "../components/charts/ScoreTrendChart"

import "../styles/pages/InsightsPage.css"

const TREND_LIMIT = 10

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

function average(
    values: number[],
): number | null {
    return values.length > 0
        ? Math.round(
            values.reduce(
                (sum, value) => sum + value,
                0,
            ) / values.length,
        )
        : null
}

/*
 * ลูกศร + ตัวเลข (ไม่สื่อด้วยสีอย่างเดียว)
 */
function DeltaBadge({
    value,
    suffix = "",
}: {
    value: number | null
    suffix?: string
}) {
    if (value === null) {
        return null
    }

    const tone =
        value > 0
            ? "up"
            : value < 0
                ? "down"
                : "flat"

    const Icon =
        tone === "up"
            ? ArrowUp
            : tone === "down"
                ? ArrowDown
                : Minus

    return (
        <span
            className={`delta-badge delta-badge--${tone}`}
        >
            <Icon
                size={14}
                aria-hidden="true"
            />
            {value === 0
                ? `เท่าเดิม${suffix}`
                : `${Math.abs(value)}${suffix}`}
        </span>
    )
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

    /*
     * เรียงใหม่สุดก่อน
     */
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

    const latestBase =
        baseAnalyses[0] ?? null

    const previousBase =
        baseAnalyses[1] ?? null

    const latestScore =
        latestBase?.baseResumeScore ?? null

    const latestDelta =
        latestScore !== null &&
            previousBase?.baseResumeScore != null
            ? latestScore -
            previousBase.baseResumeScore
            : null

    const averageScore =
        average(
            baseAnalyses.map(
                (analysis) =>
                    analysis.baseResumeScore ?? 0,
            ),
        )

    const highestAnalysis =
        baseAnalyses.reduce<ResumeAnalysisRun | null>(
            (best, analysis) =>
                best === null ||
                    (analysis.baseResumeScore ?? 0) >
                    (best.baseResumeScore ?? 0)
                    ? analysis
                    : best,
            null,
        )

    const averageJobMatch =
        average(
            jobMatchAnalyses.map(
                (analysis) =>
                    analysis.jobMatchScore ?? 0,
            ),
        )

    const resumeCount =
        new Set(
            analyses.map(
                (analysis) => analysis.resumeId,
            ),
        ).size

    /*
     * เก่า → ใหม่ สำหรับกราฟ
     */
    const trendAnalyses =
        useMemo(
            () =>
                [...baseAnalyses]
                    .reverse()
                    .slice(-TREND_LIMIT),
            [baseAnalyses],
        )

    const trendPoints: TrendPoint[] =
        trendAnalyses.map((analysis) => ({
            id: analysis.id,
            label: formatThaiShortDate(
                analysis.createdAt,
            ),
            value:
                analysis.baseResumeScore ?? 0,
            tooltip: `${analysis.baseResumeScore}/100 · ${getAnalysisTypeLabel(analysis.analysisType)} · ${formatThaiDate(analysis.createdAt)}`,
        }))

    const trendChange =
        trendPoints.length > 1
            ? trendPoints[trendPoints.length - 1].value -
            trendPoints[0].value
            : null

    const latestSections =
        buildSectionScores(
            latestBase?.scores ?? null,
        )

    const previousSections =
        buildSectionScores(
            previousBase?.scores ?? null,
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
                        {analyses.length} การวิเคราะห์
                        {" · "}
                        {resumeCount} Resume
                    </span>
                </div>
            </header>

            <section
                className="insights__stats"
                aria-label="สรุปคะแนน"
            >
                <article className="insight-stat">
                    <span className="insight-stat__label">
                        <TrendingUp size={18} />
                        คะแนนล่าสุด
                    </span>

                    <strong>
                        {latestScore ?? "—"}
                        {latestScore !== null && (
                            <small>/100</small>
                        )}
                    </strong>

                    <span className="insight-stat__meta">
                        {latestDelta !== null ? (
                            <>
                                <DeltaBadge
                                    value={latestDelta}
                                />
                                จากครั้งก่อน
                            </>
                        ) : (
                            "ครั้งแรก"
                        )}
                    </span>
                </article>

                <article className="insight-stat">
                    <span className="insight-stat__label">
                        <BarChart3 size={18} />
                        คะแนนเฉลี่ย
                    </span>

                    <strong>
                        {averageScore ?? "—"}
                        {averageScore !== null && (
                            <small>/100</small>
                        )}
                    </strong>

                    <span className="insight-stat__meta">
                        จาก {baseAnalyses.length} ครั้ง
                    </span>
                </article>

                <article className="insight-stat">
                    <span className="insight-stat__label">
                        <Award size={18} />
                        คะแนนสูงสุด
                    </span>

                    <strong>
                        {highestAnalysis?.baseResumeScore ??
                            "—"}
                        {highestAnalysis && (
                            <small>/100</small>
                        )}
                    </strong>

                    <span className="insight-stat__meta">
                        {highestAnalysis
                            ? formatThaiDate(
                                highestAnalysis.createdAt,
                            )
                            : "—"}
                    </span>
                </article>

                <article className="insight-stat">
                    <span className="insight-stat__label">
                        <Target size={18} />
                        Job Match เฉลี่ย
                    </span>

                    <strong>
                        {averageJobMatch ?? "—"}
                        {averageJobMatch !== null && (
                            <small>/100</small>
                        )}
                    </strong>

                    <span className="insight-stat__meta">
                        {jobMatchAnalyses.length > 0
                            ? `จาก ${jobMatchAnalyses.length} ครั้ง`
                            : "ยังไม่มี Job Match"}
                    </span>
                </article>
            </section>

            {trendPoints.length > 0 && (
                <section className="insights__panel">
                    <div className="insights__panel-header">
                        <div>
                            <h2>
                                แนวโน้มคะแนน Resume
                            </h2>

                            <p>
                                คะแนนภาพรวม
                                {trendPoints.length > 1
                                    ? ` ${trendPoints.length} ครั้งล่าสุด`
                                    : ""}{" "}
                                เรียงตามเวลา
                            </p>
                        </div>

                        {trendChange !== null && (
                            <span className="insights__panel-chip">
                                <DeltaBadge
                                    value={trendChange}
                                    suffix=" คะแนน"
                                />
                                จากครั้งแรก
                            </span>
                        )}
                    </div>

                    <ScoreTrendChart
                        points={trendPoints}
                        ariaLabel={
                            "แนวโน้มคะแนน Resume: " +
                            trendPoints
                                .map(
                                    (point) =>
                                        `${point.label} ${point.value}`,
                                )
                                .join(", ")
                        }
                    />

                    {trendPoints.length < 3 && (
                        <p className="insights__hint">
                            วิเคราะห์ Resume เพิ่มอีกอย่างน้อย{" "}
                            {3 - trendPoints.length} ครั้ง
                            เพื่อดูแนวโน้มได้ชัดเจนขึ้น
                        </p>
                    )}
                </section>
            )}

            {latestBase && latestSections.length > 0 && (
                <section className="insights__panel">
                    <div className="insights__panel-header">
                        <div>
                            <h2>
                                คะแนนแต่ละด้าน
                            </h2>

                            <p>
                                ผลล่าสุด
                                {previousSections.length > 0
                                    ? " เทียบกับครั้งก่อน"
                                    : ""}
                            </p>
                        </div>

                        <span className="insights__panel-date">
                            {formatThaiDateTime(
                                latestBase.createdAt,
                            )}
                        </span>
                    </div>

                    <ul className="section-progress">
                        {latestSections.map(
                            (section, index) => {
                                const previous =
                                    previousSections[index]

                                return (
                                    <li
                                        key={section.key}
                                        className="section-progress__item"
                                    >
                                        <div className="section-progress__header">
                                            <span>
                                                {section.labelTh}
                                            </span>

                                            <span className="section-progress__value">
                                                <strong>
                                                    {section.score}/
                                                    {section.maxScore}
                                                </strong>

                                                <DeltaBadge
                                                    value={
                                                        previous
                                                            ? section.score -
                                                            previous.score
                                                            : null
                                                    }
                                                />
                                            </span>
                                        </div>

                                        <div
                                            className="section-progress__track"
                                            role="img"
                                            aria-label={`${section.labelTh} ${section.score} จาก ${section.maxScore}`}
                                        >
                                            <div
                                                className="section-progress__fill"
                                                style={{
                                                    width: `${section.percent}%`,
                                                }}
                                            />
                                        </div>
                                    </li>
                                )
                            },
                        )}
                    </ul>
                </section>
            )}

            <section className="insights__grid">
                <article className="insights__panel">
                    <div className="insights__panel-title insights__panel-title--strength">
                        <span className="insights__panel-icon">
                            <CheckCircle2 size={19} />
                        </span>

                        <h2>
                            จุดแข็งที่พบบ่อย
                        </h2>
                    </div>

                    {strengths.length > 0 ? (
                        <ul className="insights__list insights__list--strength">
                            {strengths.map(
                                (item) => (
                                    <li key={item.text}>
                                        <CheckCircle2
                                            size={18}
                                            aria-hidden="true"
                                        />

                                        <span>
                                            {item.text}
                                        </span>

                                        {item.count > 1 && (
                                            <small className="count-badge">
                                                {item.count} ครั้ง
                                            </small>
                                        )}
                                    </li>
                                ),
                            )}
                        </ul>
                    ) : (
                        <p className="insights__muted">
                            ยังไม่มีข้อมูล
                        </p>
                    )}
                </article>

                <article className="insights__panel">
                    <div className="insights__panel-title insights__panel-title--weakness">
                        <span className="insights__panel-icon">
                            <CircleAlert size={19} />
                        </span>

                        <h2>
                            จุดที่ควรปรับปรุง
                        </h2>
                    </div>

                    {weaknesses.length > 0 ? (
                        <ul className="insights__list insights__list--weakness">
                            {weaknesses.map(
                                (item) => (
                                    <li key={item.text}>
                                        <CircleAlert
                                            size={18}
                                            aria-hidden="true"
                                        />

                                        <span>
                                            {item.text}
                                        </span>

                                        {item.count > 1 && (
                                            <small className="count-badge">
                                                {item.count} ครั้ง
                                            </small>
                                        )}
                                    </li>
                                ),
                            )}
                        </ul>
                    ) : (
                        <p className="insights__muted">
                            ยังไม่มีข้อมูล
                        </p>
                    )}
                </article>
            </section>

            <section className="insights__panel">
                <div className="insights__panel-title insights__panel-title--tip">
                    <span className="insights__panel-icon">
                        <Lightbulb size={19} />
                    </span>

                    <h2>
                        คำแนะนำที่ควรให้ความสำคัญ
                    </h2>
                </div>

                {recommendations.length > 0 ? (
                    <ol className="insights__recommendations">
                        {recommendations.map(
                            (item, index) => (
                                <li
                                    key={item.text}
                                    className="recommendation-item"
                                >
                                    <span className="recommendation-item__number">
                                        {index + 1}
                                    </span>

                                    <p>
                                        {item.text}
                                    </p>

                                    {item.count > 1 && (
                                        <small className="count-badge">
                                            พบ {item.count} ครั้ง
                                        </small>
                                    )}
                                </li>
                            ),
                        )}
                    </ol>
                ) : (
                    <p className="insights__muted">
                        ยังไม่มีคำแนะนำ
                    </p>
                )}
            </section>
        </main>
    )
}
