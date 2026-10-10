import {
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import type {
  ResumeAnalysisRun,
} from "../../types/analysis"

import {
  useCountUp,
} from "../../hooks/useCountUp"

import {
  AnalysisHeader,
  AnalysisTagList,
  RecommendationsCard,
} from "./AnalysisResultParts"

function clampPercent(value: number): number {
  return Math.min(100, Math.max(0, value))
}

function MatchScoreCard({
  score,
}: {
  score: number | null
}) {
  // นับขึ้นจาก 0 + แถบเติมพร้อมกัน
  const displayed = useCountUp(score ?? 0)

  return (
    <div className="job-match-score-card">
      <div className="job-match-score-card__top">
        <div>
          <p>Match Score</p>

          <strong className="tabular-nums">
            {score === null ? "—" : displayed}

            {score !== null && (
              <span>/100</span>
            )}
          </strong>
        </div>

        <Sparkles size={26} />
      </div>

      {score !== null && (
        <progress
          className="job-match-progress"
          aria-label="Job Match Score"
          value={clampPercent(displayed)}
          max={100}
        />
      )}
    </div>
  )
}

export function JobMatchResultView({
  analysis,
}: {
  analysis: ResumeAnalysisRun
}) {
  const jobMatch = analysis.jobMatch

  const matchScore =
    analysis.jobMatchScore ??
    jobMatch?.score ??
    null

  const location = analysis.job?.location
    ? ` · ${analysis.job.location}`
    : ""

  return (
    <main className="analysis-page">
      <AnalysisHeader
        eyebrow="Job Match Analysis"
        title={
          analysis.job?.title ??
          "Job Match Result"
        }
        description={
          `${analysis.job?.company ?? "ไม่ระบุบริษัท"}${location}`
        }
        status="COMPLETED"
      />

      <section className="job-match-overview">
        <MatchScoreCard score={matchScore} />

        <div className="analysis-summary-card">
          <h2>Why this job matches you</h2>

          <p>
            {analysis.summary ||
              "ไม่มี Summary สำหรับการวิเคราะห์นี้"}
          </p>
        </div>
      </section>

      <section className="analysis-section">
        <div className="analysis-section__heading">
          <h2>Skills Match</h2>

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
                <span className="job-match-count">
                  {jobMatch?.matchedSkills.length ?? 0}
                </span>
              </h3>
            </div>

            <AnalysisTagList
              items={jobMatch?.matchedSkills}
              variant="matched"
              emptyText="ไม่พบ Matching Skills"
            />
          </article>

          <article className="job-match-skills-card">
            <div className="job-match-skills-card__heading">
              <ThumbsDown size={20} />

              <h3>
                Missing Skills
                <span className="job-match-count">
                  {jobMatch?.missingSkills.length ?? 0}
                </span>
              </h3>
            </div>

            <AnalysisTagList
              items={jobMatch?.missingSkills}
              variant="missing"
              emptyText="ไม่พบ Missing Skills"
            />
          </article>
        </div>
      </section>

      <section className="analysis-section">
        <div className="analysis-section__heading">
          <h2>Keyword Matches</h2>

          <p>
            Keywords ที่พบทั้งใน Resume
            และ Job Description
          </p>
        </div>

        <AnalysisTagList
          items={jobMatch?.keywordMatches}
          emptyText="ไม่พบ Keyword Matches"
        />
      </section>

      <RecommendationsCard
        recommendations={analysis.recommendations}
        description="แนวทางเพิ่มความเหมาะสม กับตำแหน่งงานนี้"
      />

      {analysis.job?.sourceUrl && (
        <div className="job-match-source">
          <a
            href={analysis.job.sourceUrl}
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
