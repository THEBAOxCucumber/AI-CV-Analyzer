import {
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Briefcase,
  ChartLine,
  FileCheck2,
  FileText,
  Gauge,
  Trash2,
  Upload,
} from "lucide-react"

import {
  useEffect,
  useState,
  type CSSProperties,
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

import {
  ModalDialog,
} from "../components/ui/ModalDialog"

import "../styles/pages/DashboardPage.css"

/*
 * แถวโครงร่างตอนโหลด (ไอคอน + 2 บรรทัด + วงคะแนน)
 */
function DashboardSkeletonRows({
  count,
}: {
  count: number
}) {
  return (
    <div aria-busy="true" aria-label="กำลังโหลดข้อมูล">
      {Array.from({ length: count }, (_, index) => (
        <div
          key={index}
          className="dashboard-skeleton-row"
          aria-hidden="true"
        >
          <span className="skeleton" style={{ width: 40, height: 40 }} />

          <div className="dashboard-skeleton-row__text">
            <span className="skeleton" style={{ width: "62%", height: 14 }} />
            <span className="skeleton" style={{ width: "38%", height: 12 }} />
          </div>

          <span className="skeleton" style={{ width: 44, height: 44, borderRadius: "50%" }} />
        </div>
      ))}
    </div>
  )
}






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
            สวัสดี, {user?.firstName}
          </h1>

          <p className="dashboard__subtitle">
            มาปรับ Resume ให้พร้อม
            สำหรับงานที่คุณต้องการ
          </p>
        </div>

        <Link
          className="dashboard__upload-button"
          to="/resumes/upload"
        >
          <Upload size={20} />
          อัปโหลด Resume
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
        aria-label="สถิติภาพรวม"
      >
        <article className="stat-card">
          <span className="stat-card__label">
            <span className="stat-card__icon">
              <FileCheck2 size={18} />
            </span>
            Resume ที่วิเคราะห์แล้ว
          </span>

          <strong className="stat-card__value">
            {isLoading
              ? <span className="skeleton" aria-hidden="true" />
              : stats.analyzedCount}
          </strong>

          {!isLoading &&
            (stats.analyzedChangePercent !== null ? (
              <TrendText
                value={
                  stats.analyzedChangePercent
                }
                suffix="% จากเดือนก่อน"
              />
            ) : (
              <p className="stat-card__trend stat-card__trend--muted">
                เดือนนี้ {stats.analyzedThisMonth} ครั้ง
              </p>
            ))}
        </article>

        <article className="stat-card">
          <span className="stat-card__label">
            <span className="stat-card__icon">
              <Gauge size={18} />
            </span>
            คะแนน Resume เฉลี่ย
          </span>

          <strong className="stat-card__value">
            {isLoading
              ? <span className="skeleton" aria-hidden="true" />
              : stats.averageScore ?? "—"}

            {!isLoading &&
              stats.averageScore !== null && (
                <small>/100</small>
              )}
          </strong>

          {!isLoading &&
            stats.averageScoreChange !== null && (
              <TrendText
                value={
                  stats.averageScoreChange
                }
                suffix=" คะแนนจากเดือนก่อน"
              />
            )}
        </article>

        <article className="stat-card">
          <span className="stat-card__label">
            <span className="stat-card__icon">
              <Briefcase size={18} />
            </span>
            Job Match
          </span>

          <strong className="stat-card__value">
            {isLoading
              ? <span className="skeleton" aria-hidden="true" />
              : stats.jobMatchCount}
          </strong>

          {!isLoading &&
            (stats.jobMatchesThisMonth > 0 ? (
              <p className="stat-card__trend">
                <span
                  className="stat-card__dot"
                  aria-hidden="true"
                />
                เดือนนี้เพิ่ม {stats.jobMatchesThisMonth} ครั้ง
              </p>
            ) : (
              <p className="stat-card__trend stat-card__trend--muted">
                เดือนนี้ยังไม่มี Job Match ใหม่
              </p>
            ))}
        </article>
      </section>

      <div className="dashboard__grid">
        <section className="dashboard-card recent-analysis">
          <h2>
            การวิเคราะห์ล่าสุด
          </h2>

          {isLoading ? (
            <DashboardSkeletonRows count={3} />
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
                        <span
                          className="recent-analysis__icon"
                          aria-hidden="true"
                        >
                          <FileText size={18} />
                        </span>

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
                            style={{ "--score": score } as CSSProperties}
                            aria-label={`คะแนน ${score}`}
                          >
                            <span>{score}</span>
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
            ดูประวัติทั้งหมด
            <ArrowRight size={20} />
          </Link>
        </section>

        <div className="dashboard__side">
          <section className="dashboard-card top-skills">
            <h2>
              ทักษะที่ตรงกับงานบ่อยที่สุด
            </h2>

            {isLoading ? (
              <div
                className="top-skills__list"
                aria-busy="true"
                aria-label="กำลังโหลดทักษะ"
              >
                {[78, 64, 52, 40].map((width) => (
                  <span
                    key={width}
                    className="skeleton"
                    style={{ width: `${width}%`, height: 12 }}
                    aria-hidden="true"
                  />
                ))}
              </div>
            ) : topSkills.length === 0 ? (
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

                    <small>
                      {item.count} งาน
                    </small>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <section className="dashboard-card improve-card">
            <div>
              <h2>
                เพิ่มคะแนน Resume
              </h2>

              <p>
                ดูคำแนะนำเฉพาะสำหรับ Resume ของคุณ
              </p>

              <Link
                className="dashboard-card__link"
                to="/insights"
              >
                ดูคำแนะนำ
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
          <div className="dashboard__panel-skeleton">
            <DashboardSkeletonRows count={2} />
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
              อัปโหลด Resume
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
                    <ModalDialog
                      labelledBy="delete-resume-title"
                      dismissible={deletingResumeId === null}
                      onClose={() => {
                        setResumeToDelete(null)
                      }}
                    >
                      <div className="delete-modal__dialog">
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
                    </ModalDialog>
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