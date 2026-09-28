import type {
  ReactNode,
} from "react"

import {
  ArrowUp,
  CheckCircle2,
} from "lucide-react"

import logoWhite from "../../assets/brand/logo-white.png"

const FEATURES = [
  "วิเคราะห์ Resume ด้วย AI ภายในไม่กี่นาที",
  "เทียบความเหมาะสมกับตำแหน่งงานจริง",
  "คำแนะนำที่นำไปปรับใช้ได้ทันที",
]

const PREVIEW_SCORE = 78
const RING_RADIUS = 26
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS

/*
 * ครึ่งซ้ายของหน้า Sign In / Register / Forgot Password
 */
export function AuthShowcase({
  title,
  description,
}: {
  title: ReactNode
  description: ReactNode
}) {
  return (
    <section className="sign-in__brand">
      <div className="sign-in__brand-content">
        <img
          className="sign-in__logo"
          src={logoWhite}
          alt="AI Resume Analyzer"
          width={480}
          height={208}
        />

        <h1>{title}</h1>

        <p>{description}</p>

        {/*
          * ภาพประกอบ (ข้อมูลตัวอย่าง)
          */}
        <div
          className="auth-preview"
          aria-hidden="true"
        >
          <div className="auth-preview__score">
            <svg viewBox="0 0 64 64">
              <circle
                className="auth-preview__track"
                cx="32"
                cy="32"
                r={RING_RADIUS}
              />

              <circle
                className="auth-preview__value"
                cx="32"
                cy="32"
                r={RING_RADIUS}
                strokeDasharray={RING_CIRCUMFERENCE}
                strokeDashoffset={
                  RING_CIRCUMFERENCE *
                  (1 - PREVIEW_SCORE / 100)
                }
                transform="rotate(-90 32 32)"
              />
            </svg>

            <strong>{PREVIEW_SCORE}</strong>
          </div>

          <div className="auth-preview__body">
            <div className="auth-preview__row">
              <span>Resume Score</span>

              <em>
                <ArrowUp size={13} />
                8 points
              </em>
            </div>

            <div className="auth-preview__chips">
              <span>Node.js</span>
              <span>React</span>
              <span>SQL</span>
            </div>
          </div>
        </div>

        <ul
          className="auth-features"
          aria-hidden="true"
        >
          {FEATURES.map((feature) => (
            <li key={feature}>
              <CheckCircle2 size={18} />
              {feature}
            </li>
          ))}
        </ul>
      </div>
    </section>
  )
}
