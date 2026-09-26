import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  ChartLine,
  FileText,
  Trash2,
  Upload,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  Link,
} from "react-router-dom"

import {
  useAuth,
} from "../hooks/useAuth"

import {
  deleteResume,
  getResumes,
} from "../services/resume.service"

import type {
  Resume,
} from "../types/resume"

import {
  getResumeAnalysisHistory,
} from "../services/analysis.service"

import type {
  ResumeAnalysisRun,
} from "../types/analysis"

import {
  formatThaiDate,
  formatThaiDateTime,
} from "../utils/date-time"

import {
  getAnalysisScore,
  getAnalysisTypeLabel,
} from "../utils/analysis"

import {
  formatFileSize,
} from "../utils/file-size"

import {
  getDashboardStats,
  getScoreTone,
  getTopSkills,
} from "../utils/dashboard-stats"

import "../styles/pages/DashboardPage.css"






function getStatusLabel(
  status: Resume["status"],
): string {
  switch (status) {
    case "COMPLETED":
      return "พร้อมใช้งาน"

    case "PROCESSING":
      return "กำลังประมวลผล"

    case "FAILED":
      return "ไม่สำเร็จ"

    default:
      return "อัปโหลดแล้ว"
  }
}

function TrendText({
  value,
  suffix,
}: {
  value: number
  suffix: string
}) {
  const isDown = value < 0

  return (
    <p
      className={
        isDown
          ? "stat-card__trend stat-card__trend--down"
          : "stat-card__trend"
      }
    >
      {isDown ? (
        <ArrowDown size={18} />
      ) : (
        <ArrowUp size={18} />
      )}

      {Math.abs(value)}
      {suffix}
    </p>
  )
}

export function DashboardPage() {
  const { user } = useAuth()

  const [resumes, setResumes] =
    useState<Resume[]>([])

  const [analyses, setAnalyses] =
    useState<ResumeAnalysisRun[]>([])

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [deletingResumeId, setDeletingResumeId] = useState<number | null>(null)
  const [resumeToDelete, setResumeToDelete] = useState<Resume | null>(null)

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const resumeResponse =
          await getResumes()

        const loadedResumes =
          resumeResponse.data.resumes

        const historyResponses =
          await Promise.all(
            loadedResumes.map(
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
          setResumes(
            loadedResumes,
          )

          setAnalyses(
            loadedAnalyses,
          )
        }
      } catch {
        if (!cancelled) {
          setError(
            "ไม่สามารถโหลดข้อมูล Dashboard ได้",
          )
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadDashboard()

    return () => {
      cancelled = true
    }
  }, [])

  const recentResumes =
    resumes.slice(0, 5)

  const stats =
    getDashboardStats(analyses)

  const topSkills =
    getTopSkills(analyses)

  /*
   * analyses เรียงใหม่สุดก่อนแล้ว
   * (loadDashboard)
   */
  const recentAnalyses =
    analyses
      .filter(
        (analysis) =>
          analysis.status === "COMPLETED",
      )
      .slice(0, 3)

  const resumeNameById =
    new Map(
      resumes.map((resume) => [
        resume.id,
        resume.originalName,
      ]),
    )




  async function handleDeleteResume() {
    if (!resumeToDelete) return

    const resume = resumeToDelete

    setDeletingResumeId(resume.id)
    setError("")

    try {
      await deleteResume(resume.id)

      setResumes((current) =>
        current.filter((item) => item.id !== resume.id),
      )

      setAnalyses((current) =>
        current.filter(
          (analysis) => analysis.resumeId !== resume.id,
        ),
      )

      setResumeToDelete(null)
    } catch {
      setError("ไม่สามารถลบ Resume ได้")
    } finally {
      setDeletingResumeId(null)
    }
  }

  return (
    <main className="dashboard">
      <header className="dashboard__header">
        <div>
          <h1>
            Hello, {user?.firstName} !
          </h1>

          <p className="dashboard__subtitle">
            Let's improve your resume
            and get you hired
          </p>
        </div>

        <Link
          className="dashboard__upload-button"
          to="/resumes/upload"
        >
          <Upload size={20} />
          Upload Resume
        </Link>
      </header>

      {error && (
        <div
          className="dashboard__error"
          role="alert"
        >
          {error}
        </div>
      )}

      <section
        className="dashboard__stats"
        aria-label="Dashboard statistics"
      >
        <article className="stat-card">
          <span className="stat-card__label">
            Resumes Analyzed
          </span>

          <strong className="stat-card__value">
            {isLoading
              ? "..."
              : stats.analyzedCount}
          </strong>

          {!isLoading &&
            (stats.analyzedChangePercent !== null ? (
              <TrendText
                value={
                  stats.analyzedChangePercent
                }
                suffix="% this month"
              />
            ) : (
              <p className="stat-card__trend stat-card__trend--muted">
                {stats.analyzedThisMonth} this month
              </p>
            ))}
        </article>

        <article className="stat-card">
          <span className="stat-card__label">
            Avg. Resume Score
          </span>

          <strong className="stat-card__value">
            {isLoading
              ? "..."
              : stats.averageScore !== null
                ? `${stats.averageScore} / 100`
                : "—"}
          </strong>

          {!isLoading &&
            stats.averageScoreChange !== null && (
              <TrendText
                value={
                  stats.averageScoreChange
                }
                suffix=" points"
              />
            )}
        </article>

        <article className="stat-card">
          <span className="stat-card__label">
            Job Matches
          </span>

          <strong className="stat-card__value">
            {isLoading
              ? "..."
              : stats.jobMatchCount}
          </strong>

          {!isLoading &&
            (stats.jobMatchesThisMonth > 0 ? (
              <p className="stat-card__trend">
                <span
                  className="stat-card__dot"
                  aria-hidden="true"
                />
                {stats.jobMatchesThisMonth} new
                matches this month
              </p>
            ) : (
              <p className="stat-card__trend stat-card__trend--muted">
                No new matches this month
              </p>
            ))}
        </article>
      </section>

      <div className="dashboard__grid">
        <section className="dashboard-card recent-analysis">
          <h2>
            Recent Analysis
          </h2>

          {isLoading ? (
            <div className="dashboard__state">
              กำลังโหลดข้อมูล...
            </div>
          ) : recentAnalyses.length === 0 ? (
            <p className="dashboard-card__empty">
              ยังไม่มีผลการวิเคราะห์
            </p>
          ) : (
            <ul className="recent-analysis__list">
              {recentAnalyses.map(
                (analysis) => {
                  const score =
                    getAnalysisScore(
                      analysis,
                    )

                  return (
                    <li key={analysis.id}>
                      <Link
                        className="recent-analysis__item"
                        to={`/analyses/${analysis.id}`}
                      >
                        <div className="recent-analysis__details">
                          <strong>
                            {resumeNameById.get(
                              analysis.resumeId,
                            ) ?? "Resume"}
                          </strong>

                          <span>
                            {getAnalysisTypeLabel(
                              analysis.analysisType,
                            )}
                            {" · "}
                            {formatThaiDate(
                              analysis.createdAt,
                            )}
                          </span>
                        </div>

                        {score !== null && (
                          <span
                            className={`score-ring score-ring--${getScoreTone(score)}`}
                            aria-label={`คะแนน ${score}`}
                          >
                            {score}
                          </span>
                        )}
                      </Link>
                    </li>
                  )
                },
              )}
            </ul>
          )}

          <Link
            className="dashboard-card__link"
            to="/history"
          >
            View all history
            <ArrowRight size={20} />
          </Link>
        </section>

        <div className="dashboard__side">
          <section className="dashboard-card top-skills">
            <h2>
              Top Skills
            </h2>

            {topSkills.length === 0 ? (
              <p className="dashboard-card__empty">
                วิเคราะห์แบบ Job Match
                เพื่อดูทักษะที่ตรงกับงาน
              </p>
            ) : (
              <ul className="top-skills__list">
                {topSkills.map((item) => (
                  <li key={item.skill}>
                    <span>
                      {item.skill}
                    </span>

                    <div
                      className="top-skills__bar"
                      role="img"
                      aria-label={`${item.skill} ตรงกับงาน ${item.count} ครั้ง`}
                    >
                      <div
                        style={{
                          width: `${Math.round(item.ratio * 100)}%`,
                        }}
                      />
                    </div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-card improve-card">
            <div>
              <h2>
                Improve your score
              </h2>

              <p>
                Get personalized tips
                to boost your resume.
              </p>

              <Link
                className="dashboard-card__link"
                to="/insights"
              >
                View Recommendations
                <ArrowRight size={20} />
              </Link>
            </div>

            <ChartLine
              className="improve-card__icon"
              size={72}
              strokeWidth={1.25}
              aria-hidden="true"
            />
          </section>
        </div>
      </div>

      <section className="dashboard__panel">
        <div className="dashboard__panel-header">
          <div>
            <h2>
              Resume ล่าสุด
            </h2>

            <p>
              Resume ที่คุณอัปโหลดล่าสุด
            </p>
          </div>

          <Link to="/history">
            ดูทั้งหมด
          </Link>
        </div>

        {isLoading ? (
          <div className="dashboard__state">
            กำลังโหลดข้อมูล...
          </div>
        ) : recentResumes.length === 0 ? (
          <div className="dashboard__empty">
            <div className="dashboard__empty-icon">
              <FileText size={30} />
            </div>

            <h3>
              ยังไม่มี Resume
            </h3>

            <p>
              อัปโหลด Resume PDF
              เพื่อเริ่มวิเคราะห์ด้วย AI
            </p>

            <Link
              to="/resumes/upload"
              className="dashboard__empty-link"
            >
              Upload Resume
            </Link>
          </div>
        ) : (
          <div className="resume-list">
            {recentResumes.map(
              (resume) => (
                <article
                  key={resume.id}
                  className="resume-list__item"
                >
                  <div className="resume-list__file-icon">
                    <FileText
                      size={22}
                    />
                  </div>

                  <div className="resume-list__details">
                    <strong>
                      {
                        resume.originalName
                      }
                    </strong>

                    <span>
                      {formatFileSize(
                        resume.fileSize,
                      )}
                      {" • "}
                      {resume.createdAt
                        ? formatThaiDateTime(
                          resume.createdAt,
                        )
                        : "-"}
                    </span>
                  </div>

                  <span
                    className={[
                      "resume-list__status",
                      `resume-list__status--${resume.status.toLowerCase()}`,
                    ].join(" ")}
                  >
                    {getStatusLabel(
                      resume.status,
                    )}
                  </span>

                  <button
                    type="button"
                    className="resume-list__delete"
                    aria-label={`ลบ ${resume.originalName}`}
                    title="ลบ Resume"
                    disabled={
                      deletingResumeId === resume.id
                    }
                    onClick={() => {
                      setResumeToDelete(resume)
                    }}
                  >
                    <Trash2 size={18} />
                  </button>
                  {resumeToDelete?.id === resume.id && (
                    <div
                      className="delete-modal"
                      role="presentation"
                      onMouseDown={() => {
                        if (deletingResumeId === null) {
                          setResumeToDelete(null)
                        }
                      }}
                    >
                      <div
                        className="delete-modal__dialog"
                        role="dialog"
                        aria-modal="true"
                        aria-labelledby="delete-resume-title"
                        onMouseDown={(event) => {
                          event.stopPropagation()
                        }}
                      >
                        <div className="delete-modal__icon">
                          <Trash2 size={24} />
                        </div>

                        <div className="delete-modal__content">
                          <h2 id="delete-resume-title">
                            ลบ Resume?
                          </h2>

                          <p>
                            ต้องการลบ{" "}
                            <strong>{resumeToDelete.originalName}</strong>{" "}
                            ใช่หรือไม่?
                          </p>

                          <p className="delete-modal__warning">
                            ข้อมูลการวิเคราะห์ของ Resume นี้จะถูกลบด้วย
                          </p>
                        </div>

                        <div className="delete-modal__actions">
                          <button
                            type="button"
                            className="delete-modal__cancel"
                            disabled={deletingResumeId !== null}
                            onClick={() => {
                              setResumeToDelete(null)
                            }}
                          >
                            ยกเลิก
                          </button>

                          <button
                            type="button"
                            className="delete-modal__confirm"
                            disabled={deletingResumeId !== null}
                            onClick={() => {
                              void handleDeleteResume()
                            }}
                          >
                            {deletingResumeId !== null
                              ? "กำลังลบ..."
                              : "ลบ Resume"}
                          </button>
                        </div>
                      </div>
                    </div>
                  )}
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  )
}