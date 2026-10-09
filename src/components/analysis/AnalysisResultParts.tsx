import {
  CheckCircle2,
  Lightbulb,
  LoaderCircle,
  XCircle,
} from "lucide-react"

import type {
  ReactNode,
} from "react"

/*
 * ชิ้นส่วนที่หน้า Analysis Result ใช้ซ้ำ
 */

export function AnalysisHeader({
  eyebrow,
  title,
  description,
  status,
}: {
  eyebrow: string
  title: string
  description?: ReactNode
  status: "COMPLETED" | "FAILED"
}) {
  return (
    <header className="analysis-header">
      <div>
        <p className="analysis-eyebrow">
          {eyebrow}
        </p>

        <h1>{title}</h1>

        {description && (
          <p className="analysis-header__description">
            {description}
          </p>
        )}
      </div>

      {status === "COMPLETED" ? (
        <span className="analysis-status analysis-status--completed">
          <CheckCircle2 size={15} />
          COMPLETED
        </span>
      ) : (
        <span className="analysis-status analysis-status--failed">
          FAILED
        </span>
      )}
    </header>
  )
}

/*
 * หน้าเต็มสำหรับ loading / error (ก่อนมีข้อมูล)
 */
export function AnalysisStateMessage({
  title,
  message,
  isLoading = false,
}: {
  title: string
  message?: string
  isLoading?: boolean
}) {
  return (
    <main className="analysis-page">
      <div
        className={
          isLoading
            ? "analysis-state"
            : "analysis-state analysis-state--error"
        }
      >
        {isLoading ? (
          <LoaderCircle
            className="analysis-spinner"
            size={36}
          />
        ) : (
          <XCircle size={36} />
        )}

        <h1>{title}</h1>

        {message && <p>{message}</p>}
      </div>
    </main>
  )
}

export function AnalysisTagList({
  items,
  variant,
  emptyText,
}: {
  items: string[] | undefined
  variant?: "matched" | "missing"
  emptyText: string
}) {
  if (!items || items.length === 0) {
    return (
      <p className="analysis-empty">
        {emptyText}
      </p>
    )
  }

  const className = variant
    ? `job-match-tag job-match-tag--${variant}`
    : "job-match-tag"

  return (
    <div className="job-match-tags">
      {items.map((item) => (
        <span
          className={className}
          key={item}
        >
          {item}
        </span>
      ))}
    </div>
  )
}

export function RecommendationsCard({
  recommendations,
  description,
}: {
  recommendations: string[]
  description: string
}) {
  return (
    <section className="recommendations-card">
      <div className="recommendations-card__heading">
        <Lightbulb size={23} />

        <div>
          <h2>Recommendations</h2>

          <p>{description}</p>
        </div>
      </div>

      {recommendations.length > 0 ? (
        <ol>
          {recommendations.map(
            (recommendation, index) => (
              <li
                key={`${index}-${recommendation}`}
              >
                <span>{index + 1}</span>

                <p>{recommendation}</p>
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
  )
}
