import {
  BriefcaseBusiness,
  Check,
  Clock3,
  Lightbulb,
  RotateCcw,
  Sparkles,
  TriangleAlert,
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

import "../../styles/components/AnalysisProgress.css"

const TIP_INTERVAL_SECONDS = 6

/*
 * เกินนี้ถือว่านานกว่าปกติ
 */
const SLOW_AFTER_SECONDS = 180

const TIPS = [
  "ใส่ตัวเลขผลลัพธ์ในประสบการณ์ เช่น “ลดเวลาประมวลผลลง 30%” ช่วยให้คะแนนสูงขึ้น",
  "สรุปโปรไฟล์ 3–4 บรรทัดที่บอกจุดเด่นและตำแหน่งที่ต้องการ ช่วยให้ผู้คัดเลือกเข้าใจเร็วขึ้น",
  "ใช้คีย์เวิร์ดเดียวกับประกาศงาน เพื่อให้ผ่านระบบคัดกรองอัตโนมัติ (ATS) ได้ง่ายขึ้น",
  "แนบลิงก์ GitHub หรือ Portfolio ของโปรเจกต์หลัก เพื่อแสดงผลงานจริง",
  "จัดหัวข้อให้ชัดเจนและสม่ำเสมอ ช่วยให้ทั้งคนและ AI อ่าน Resume ได้ง่าย",
]

const BASE_STEPS = [
  "รับคำขอวิเคราะห์",
  "อ่านเนื้อหา Resume",
  "ให้คะแนน 7 หมวด",
  "สรุปจุดแข็งและคำแนะนำ",
]

const JOB_MATCH_STEPS = [
  "รับคำขอวิเคราะห์",
  "อ่าน Resume และรายละเอียดงาน",
  "เทียบทักษะและคีย์เวิร์ด",
  "สรุปคะแนนความเหมาะสม",
]

const BASE_RESULTS = [
  "คะแนนรวมและคะแนน 7 หมวด",
  "จุดแข็งและจุดที่ควรปรับ",
  "คำแนะนำที่นำไปใช้ได้ทันที",
]

const JOB_MATCH_RESULTS = [
  "คะแนนความเหมาะสมกับงาน",
  "ทักษะที่ตรงและที่ยังขาด",
  "คีย์เวิร์ดและคำแนะนำ",
]

type StepState =
  | "done"
  | "active"
  | "waiting"

/*
 * backend บอกแค่ QUEUED/PROCESSING
 * → ขั้นย่อยเป็นการประมาณจากเวลา
 */
function getActiveStep(
  status: ResumeAnalysisRun["status"],
  elapsedSeconds: number,
): number {
  if (status !== "PROCESSING") {
    return 0
  }

  if (elapsedSeconds < 20) {
    return 1
  }

  if (elapsedSeconds < 75) {
    return 2
  }

  return 3
}

function formatElapsed(
  totalSeconds: number,
): string {
  const minutes = Math.floor(totalSeconds / 60)
  const seconds = totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function AnalysisProgress({
  analysis,
}: {
  analysis: ResumeAnalysisRun
}) {
  const [now, setNow] =
    useState(() => Date.now())

  useEffect(() => {
    const intervalId = setInterval(
      () => setNow(Date.now()),
      1000,
    )

    return () => {
      clearInterval(intervalId)
    }
  }, [])

  /*
   * นับจาก createdAt จริง
   * refresh แล้วไม่เริ่มนับใหม่
   */
  const elapsedSeconds = Math.max(
    0,
    Math.floor(
      (now - new Date(analysis.createdAt).getTime()) / 1000,
    ),
  )

  const isJobMatch =
    analysis.analysisType !== "BASE"

  const isQueued =
    analysis.status !== "PROCESSING"

  const steps = isJobMatch
    ? JOB_MATCH_STEPS
    : BASE_STEPS

  const results = isJobMatch
    ? JOB_MATCH_RESULTS
    : BASE_RESULTS

  const activeStep =
    getActiveStep(
      analysis.status,
      elapsedSeconds,
    )

  const tip =
    TIPS[
      Math.floor(elapsedSeconds / TIP_INTERVAL_SECONDS) %
        TIPS.length
    ]

  const title = isQueued
    ? "อยู่ในคิว กำลังจะเริ่มวิเคราะห์"
    : isJobMatch
      ? "AI กำลังเทียบ Resume กับตำแหน่งงาน"
      : "AI กำลังวิเคราะห์ Resume ของคุณ"

  return (
    <div className="analysis-progress">
      <section className="analysis-progress__hero">
        <div
          className="analysis-progress__orb"
          aria-hidden="true"
        >
          <span />
          <span />
          <Sparkles size={28} />
        </div>

        <div className="analysis-progress__intro">
          <div className="analysis-progress__eyebrow">
            <span>
              {isJobMatch
                ? "วิเคราะห์ Job Match"
                : "วิเคราะห์ Resume ด้วย AI"}
            </span>

            <span className="analysis-progress__status">
              {analysis.status}
            </span>
          </div>

          <h1 aria-live="polite">
            {title}
          </h1>

          {isJobMatch && analysis.job && (
            <p className="analysis-progress__job">
              <BriefcaseBusiness size={16} />
              <span>
                {analysis.job.title}
                {analysis.job.company
                  ? ` · ${analysis.job.company}`
                  : ""}
              </span>
            </p>
          )}

          <p className="analysis-progress__time">
            <Clock3 size={16} />
            <strong>
              {formatElapsed(elapsedSeconds)}
            </strong>
            <span>
              โดยปกติใช้เวลา 1–2 นาที
              · หน้านี้อัปเดตเองอัตโนมัติ
            </span>
          </p>
        </div>

        {/*
          * แถบวิ่งตกแต่ง — สถานะจริงเป็นข้อความด้านบนแล้ว
          */}
        <div
          className="analysis-progress__bar"
          aria-hidden="true"
        >
          <span />
        </div>
      </section>

      {analysis.attemptCount > 1 && (
        <p className="analysis-progress__notice">
          <RotateCcw size={16} />
          AI ตอบกลับไม่สำเร็จในรอบก่อน
          ระบบกำลังลองใหม่อัตโนมัติ
          (ครั้งที่ {analysis.attemptCount})
        </p>
      )}

      {elapsedSeconds > SLOW_AFTER_SECONDS && (
        <p className="analysis-progress__notice analysis-progress__notice--slow">
          <TriangleAlert size={16} />
          ใช้เวลานานกว่าปกติ อาจมีงานวิเคราะห์อื่นรอในคิว
          ปิดหน้านี้ไปก่อนได้ ผลจะอยู่ใน History
        </p>
      )}

      <div className="analysis-progress__grid">
        <section className="analysis-progress__card">
          <h2>
            ขั้นตอน
            <small>ประมาณการ</small>
          </h2>

          <ol className="progress-steps">
            {steps.map((step, index) => {
              const state: StepState =
                index < activeStep
                  ? "done"
                  : index === activeStep
                    ? "active"
                    : "waiting"

              return (
                <li
                  key={step}
                  className={`progress-steps__item progress-steps__item--${state}`}
                  aria-current={
                    state === "active"
                      ? "step"
                      : undefined
                  }
                >
                  <span
                    className="progress-steps__marker"
                    aria-hidden="true"
                  >
                    {state === "done" ? (
                      <Check size={14} />
                    ) : state === "active" ? (
                      <span className="progress-steps__pulse" />
                    ) : (
                      index + 1
                    )}
                  </span>

                  <span>
                    {index === 0 && isQueued
                      ? "รอคิววิเคราะห์"
                      : step}
                  </span>
                </li>
              )
            })}
          </ol>
        </section>

        <section
          className="analysis-progress__card"
          aria-label="ผลที่จะได้รับ"
        >
          <h2>ผลที่คุณจะได้รับ</h2>

          <div
            className="progress-skeleton"
            aria-hidden="true"
          >
            <span className="progress-skeleton__ring" />

            <div className="progress-skeleton__lines">
              <span />
              <span />
              <span />
            </div>
          </div>

          <ul className="progress-results">
            {results.map((result) => (
              <li key={result}>
                <Check size={14} />
                {result}
              </li>
            ))}
          </ul>
        </section>
      </div>

      <p className="analysis-progress__tip">
        <Lightbulb size={18} />
        <span key={tip}>
          <strong>ระหว่างรอ:</strong>{" "}
          {tip}
        </span>
      </p>

      <div className="analysis-progress__actions">
        <span>
          ไม่ต้องรอหน้านี้ก็ได้ ผลจะบันทึกไว้ใน History
        </span>

        <div>
          <Link
            to="/dashboard"
            className="analysis-progress__link"
          >
            ไปที่ Dashboard
          </Link>

          <Link
            to="/history"
            className="analysis-progress__link analysis-progress__link--primary"
          >
            ดู History
          </Link>
        </div>
      </div>
    </div>
  )
}
