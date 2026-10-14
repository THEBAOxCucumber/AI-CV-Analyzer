import {
  BriefcaseBusiness,
  Check,
  Copy,
  ExternalLink,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  Link,
} from "react-router-dom"

import type {
  ResumeAnalysisRun,
} from "../../types/analysis"

import {
  getScoreTone,
  type ScoreTone,
} from "../../utils/dashboard-stats"

import {
  AnalysisHeader,
  AnalysisTagList,
  RecommendationsCard,
} from "./AnalysisResultParts"

import {
  ScoreRing,
} from "./ScoreRing"

const MATCH_LEVEL: Record<ScoreTone, string> = {
  good: "เหมาะกับงานมาก",
  fair: "เหมาะพอสมควร",
  low: "ควรเพิ่มทักษะก่อนสมัคร",
}

/*
 * คะแนนความเหมาะสม: วงแหวนใหญ่ + ป้ายระดับ (ข้อความ ไม่ใช่สีอย่างเดียว)
 */
function MatchScoreCard({
  score,
}: {
  score: number | null
}) {
  const tone =
    score === null
      ? null
      : getScoreTone(score)

  return (
    <div className="job-match-score-card">
      <div className="job-match-score-card__label">
        <Sparkles size={20} />

        <span>คะแนนความเหมาะสม</span>
      </div>

      <ScoreRing score={score} />

      {tone && (
        <span className={`job-match-level job-match-level--${tone}`}>
          {MATCH_LEVEL[tone]}
        </span>
      )}
    </div>
  )
}

/*
 * สัดส่วนทักษะที่ตรง / ทั้งหมดที่งานต้องการ
 */
function SkillCoverage({
  matched,
  missing,
}: {
  matched: number
  missing: number
}) {
  const total = matched + missing

  if (total === 0) {
    return null
  }

  const percent = Math.round((matched / total) * 100)

  return (
    <div className="skill-coverage">
      <div className="skill-coverage__text">
        <strong className="tabular-nums">{percent}%</strong>

        <span>
          ทักษะตรงกับงาน {matched} จาก {total} ทักษะ
        </span>
      </div>

      <div
        className="skill-coverage__bar"
        role="img"
        aria-label={`ทักษะที่ตรง ${matched} ทักษะ ที่ยังขาด ${missing} ทักษะ`}
      >
        <span
          className="skill-coverage__matched"
          style={{ flexGrow: matched }}
        />
        <span
          className="skill-coverage__missing"
          style={{ flexGrow: missing }}
        />
      </div>

      <ul className="skill-coverage__legend" aria-hidden="true">
        <li className="skill-coverage__legend-matched">ตรง {matched}</li>
        <li className="skill-coverage__legend-missing">ยังขาด {missing}</li>
      </ul>
    </div>
  )
}

/*
 * คัดลอกคำแนะนำทั้งหมดเป็นรายการลำดับเลข
 */
function CopyAllButton({
  items,
}: {
  items: string[]
}) {
  const [copied, setCopied] =
    useState(false)

  useEffect(() => {
    if (!copied) {
      return
    }

    const timer = setTimeout(() => setCopied(false), 2000)
    return () => clearTimeout(timer)
  }, [copied])

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(
        items.map((item, index) => `${index + 1}. ${item}`).join("\n"),
      )
      setCopied(true)
    } catch {
      // ไม่อนุญาต clipboard (http / สิทธิ์) — เงียบไว้
    }
  }

  return (
    <button
      type="button"
      className="job-match-action"
      onClick={() => void handleCopy()}
    >
      {copied
        ? <Check size={17} aria-hidden="true" />
        : <Copy size={17} aria-hidden="true" />}

      {copied
        ? "คัดลอกแล้ว"
        : "คัดลอกคำแนะนำทั้งหมด"}
    </button>
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

  const matchedCount = jobMatch?.matchedSkills.length ?? 0
  const missingCount = jobMatch?.missingSkills.length ?? 0

  const location = analysis.job?.location
    ? ` · ${analysis.job.location}`
    : ""

  return (
    <main className="analysis-page">
      <AnalysisHeader
        eyebrow="วิเคราะห์ Job Match"
        title={
          analysis.job?.title ??
          "ผล Job Match"
        }
        description={
          `${analysis.job?.company ?? "ไม่ระบุบริษัท"}${location}`
        }
        status="COMPLETED"
      />

      <section className="job-match-overview">
        <MatchScoreCard score={matchScore} />

        <div className="analysis-summary-card">
          <h2>ทำไมงานนี้เหมาะกับคุณ</h2>

          <p>
            {analysis.summary ||
              "ไม่มี Summary สำหรับการวิเคราะห์นี้"}
          </p>
        </div>
      </section>

      <section className="analysis-section">
        <div className="analysis-section__heading">
          <h2>ทักษะเทียบกับงาน</h2>

          <p>
            เปรียบเทียบทักษะใน Resume
            กับตำแหน่งงานนี้
          </p>
        </div>

        <SkillCoverage
          matched={matchedCount}
          missing={missingCount}
        />

        <div className="job-match-skills-grid">
          <article className="job-match-skills-card">
            <div className="job-match-skills-card__heading">
              <ThumbsUp size={20} />

              <h3>
                ทักษะที่ตรง
                <span className="job-match-count">
                  {matchedCount}
                </span>
              </h3>
            </div>

            <AnalysisTagList
              items={jobMatch?.matchedSkills}
              variant="matched"
              emptyText="ไม่พบทักษะที่ตรง"
            />
          </article>

          <article className="job-match-skills-card">
            <div className="job-match-skills-card__heading">
              <ThumbsDown size={20} />

              <h3>
                ทักษะที่ยังขาด
                <span className="job-match-count">
                  {missingCount}
                </span>
              </h3>
            </div>

            <AnalysisTagList
              items={jobMatch?.missingSkills}
              variant="missing"
              emptyText="ไม่มีทักษะที่ขาด"
            />
          </article>
        </div>

        <div className="job-match-keywords">
          <h3>คีย์เวิร์ดที่พบทั้งใน Resume และรายละเอียดงาน</h3>

          <AnalysisTagList
            items={jobMatch?.keywordMatches}
            emptyText="ไม่พบคีย์เวิร์ดที่ตรง"
          />
        </div>
      </section>

      <RecommendationsCard
        recommendations={analysis.recommendations}
        description="แนวทางเพิ่มความเหมาะสม กับตำแหน่งงานนี้"
      />

      <nav
        className="job-match-actions"
        aria-label="ทำต่อ"
      >
        {analysis.job?.sourceUrl && (
          <a
            className="job-match-action job-match-action--primary"
            href={analysis.job.sourceUrl}
            target="_blank"
            rel="noreferrer"
          >
            <ExternalLink size={17} aria-hidden="true" />
            ดูประกาศงานต้นฉบับ
          </a>
        )}

        <Link
          className="job-match-action"
          to="/jobs"
        >
          <BriefcaseBusiness size={17} aria-hidden="true" />
          วิเคราะห์งานอื่น
        </Link>

        {analysis.recommendations.length > 0 && (
          <CopyAllButton items={analysis.recommendations} />
        )}
      </nav>
    </main>
  )
}
