import {
  Link,
} from "react-router-dom"

import {
  BriefcaseBusiness,
  CheckCircle2,
  CircleAlert,
  Search,
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
  buildJobSearchPath,
} from "../../utils/job-search"

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
}: Readonly<{
  title: string
  items: string[]
  tone: "strength" | "weakness"
  headingIcon: LucideIcon
  itemIcon: LucideIcon
}>) {
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

/*
 * ทำต่อหลังวิเคราะห์: หางานตามตำแหน่งที่ AI แนะนำจาก Resume
 * ผลก่อน prompt v2.1.0 ไม่มีตำแหน่ง → ปุ่มหางานธรรมดา (เลือก Resume นี้ไว้ให้)
 */
function JobSuggestionsCard({
  analysis,
}: Readonly<{
  analysis: ResumeAnalysisRun
}>) {
  const titles =
    analysis.suggestedJobTitles ?? []

  return (
    <section
      className="job-suggestions"
      aria-labelledby="job-suggestions-title"
    >
      <div className="job-suggestions__text">
        <h2 id="job-suggestions-title">
          <BriefcaseBusiness
            size={20}
            aria-hidden="true"
          />
          ตำแหน่งงานที่เหมาะกับคุณ
        </h2>

        <p>
          {titles.length > 0
            ? "AI แนะนำจากทักษะและประสบการณ์ใน Resume — กดเพื่อค้นหางานตำแหน่งนั้น"
            : "ค้นหางานในประเทศไทย แล้วเทียบกับ Resume นี้ได้ทันที"}
        </p>

        {titles.length > 0 && (
          <ul className="job-suggestions__chips">
            {titles.map((title) => (
              <li key={title}>
                <Link
                  className="job-suggestions__chip"
                  to={buildJobSearchPath(
                    analysis.resumeId,
                    title,
                  )}
                >
                  {title}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      <Link
        className="job-match-action job-match-action--primary"
        to={buildJobSearchPath(
          analysis.resumeId,
          titles[0],
        )}
      >
        <Search
          size={17}
          aria-hidden="true"
        />
        {titles.length > 0
          ? "หางานที่เหมาะกับฉัน"
          : "หางาน"}
      </Link>
    </section>
  )
}

export function BaseResultView({
  analysis,
}: Readonly<{
  analysis: ResumeAnalysisRun
}>) {
  const sectionScores =
    buildSectionScores(analysis.scores)

  return (
    <main className="analysis-page">
      <AnalysisHeader
        eyebrow="วิเคราะห์ Resume ด้วย AI"
        title="ผลการวิเคราะห์"
        description="ผลการวิเคราะห์ Resume และข้อเสนอแนะจาก AI"
        status="COMPLETED"
      />

      <section className="analysis-overview">
        <div className="base-score-card">
          <div className="base-score-card__label">
            <Sparkles size={20} />

            <span>คะแนน Resume</span>
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
          <h2>สรุป</h2>

          <p>
            {analysis.summary ||
              "ไม่มี Summary สำหรับการวิเคราะห์นี้"}
          </p>
        </div>
      </section>

      <JobSuggestionsCard analysis={analysis} />

      <div className="analysis-insights-grid">
        <section className="analysis-section analysis-section--scores">
          <div className="analysis-section__heading">
            <h2>คะแนนรายหมวด</h2>

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
            title="จุดแข็ง"
            items={analysis.strengths}
            tone="strength"
            headingIcon={ThumbsUp}
            itemIcon={CheckCircle2}
          />

          <FeedbackCard
            title="จุดที่ควรปรับปรุง"
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
