import {
  CheckCircle2,
  CircleAlert,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  type LucideIcon,
} from "lucide-react"

import type {
  ResumeAnalysisRun,
} from "../../types/analysis"

import {
  buildSectionScores,
} from "../../utils/section-scores"

import {
  AnalysisHeader,
  RecommendationsCard,
} from "./AnalysisResultParts"

import {
  ScoreRing,
} from "./ScoreRing"

import {
  SectionScoresPanel,
} from "./SectionScoresPanel"

/*
 * การ์ด Strengths / Weaknesses
 */
function FeedbackCard({
  title,
  items,
  tone,
  headingIcon: HeadingIcon,
  itemIcon: ItemIcon,
}: {
  title: string
  items: string[]
  tone: "strength" | "weakness"
  headingIcon: LucideIcon
  itemIcon: LucideIcon
}) {
  return (
    <article className="feedback-card">
      <div
        className={`feedback-card__heading feedback-card__heading--${tone}`}
      >
        <span className="feedback-card__icon">
          <HeadingIcon size={19} />
        </span>

        <h2>{title}</h2>
      </div>

      {items.length > 0 ? (
        <ul
          className={`feedback-list feedback-list--${tone}`}
        >
          {items.map((item, index) => (
            <li key={`${index}-${item}`}>
              <ItemIcon
                size={18}
                aria-hidden="true"
              />

              <span>{item}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p className="analysis-empty">
          ไม่มีข้อมูล {title}
        </p>
      )}
    </article>
  )
}

export function BaseResultView({
  analysis,
}: {
  analysis: ResumeAnalysisRun
}) {
  const sectionScores =
    buildSectionScores(analysis.scores)

  return (
    <main className="analysis-page">
      <AnalysisHeader
        eyebrow="AI Resume Analysis"
        title="Analysis Result"
        description="ผลการวิเคราะห์ Resume และข้อเสนอแนะจาก AI"
        status="COMPLETED"
      />

      <section className="analysis-overview">
        <div className="base-score-card">
          <div className="base-score-card__label">
            <Sparkles size={20} />

            <span>Base Resume Score</span>
          </div>

          <div className="base-score-card__score">
            <ScoreRing
              score={analysis.baseResumeScore}
            />
          </div>

          <p>
            คะแนนภาพรวมของ Resume
            จากโครงสร้างและเนื้อหา
          </p>
        </div>

        <div className="analysis-summary-card">
          <h2>Summary</h2>

          <p>
            {analysis.summary ||
              "ไม่มี Summary สำหรับการวิเคราะห์นี้"}
          </p>
        </div>
      </section>

      <div className="analysis-insights-grid">
        <section className="analysis-section analysis-section--scores">
          <div className="analysis-section__heading">
            <h2>Section Scores</h2>

            <p>
              คะแนนแยกตามองค์ประกอบของ Resume
            </p>
          </div>

          {sectionScores.length > 0 ? (
            <SectionScoresPanel
              sections={sectionScores}
            />
          ) : (
            <p className="analysis-empty">
              ไม่มีข้อมูล Section Scores
            </p>
          )}
        </section>

        <div className="analysis-feedback-stack">
          <FeedbackCard
            title="Strengths"
            items={analysis.strengths}
            tone="strength"
            headingIcon={ThumbsUp}
            itemIcon={CheckCircle2}
          />

          <FeedbackCard
            title="Weaknesses"
            items={analysis.weaknesses}
            tone="weakness"
            headingIcon={ThumbsDown}
            itemIcon={CircleAlert}
          />
        </div>
      </div>

      <RecommendationsCard
        recommendations={analysis.recommendations}
        description="แนวทางที่ช่วยปรับปรุง Resume"
      />
    </main>
  )
}
