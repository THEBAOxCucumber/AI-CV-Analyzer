import {
  FileCheck2,
  FileText,
  Plus,
  Sparkles,
  Trash2,
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

import "../styles/pages/DashboardPage.css"



function formatFileSize(
  bytes: number,
): string {
  if (bytes < 1024) {
    return `${bytes} B`
  }

  if (bytes < 1024 * 1024) {
    return `${(
      bytes / 1024
    ).toFixed(1)} KB`
  }

  return `${(
    bytes /
    (1024 * 1024)
  ).toFixed(1)} MB`
}

function formatDate(
  value?: string,
): string {
  if (!value) {
    return "-"
  }

  const date =
    new Date(value)

  if (
    Number.isNaN(
      date.getTime(),
    )
  ) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      dateStyle: "medium",
    },
  ).format(date)
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

  const latestCompletedAnalysis =
    analyses
      .filter((analysis) => analysis.status === "COMPLETED")
      .sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime(),
      )[0] ?? null

  const latestBaseScore =
    latestCompletedAnalysis
      ?.baseResumeScore ?? null




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
          <p className="dashboard__eyebrow">
            Dashboard
          </p>

          <h1>
            สวัสดี,{" "}
            {user?.firstName}
          </h1>

          <p className="dashboard__subtitle">
            ภาพรวม Resume
            และการวิเคราะห์ของคุณ
          </p>
        </div>

        <Link
          className="dashboard__upload-button"
          to="/resumes/upload"
        >
          <Plus size={19} />
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
          <div className="stat-card__icon">
            <FileText size={23} />
          </div>

          <div>
            <span>
              Resume ทั้งหมด
            </span>

            <strong>
              {isLoading
                ? "..."
                : resumes.length}
            </strong>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card__icon">
            <Sparkles size={23} />
          </div>

          <div>
            <span>
              AI Analysis
            </span>

            <strong>
              {isLoading
                ? "..."
                : analyses.length}
            </strong>
          </div>
        </article>

        <article className="stat-card">
          <div className="stat-card__icon">
            <FileCheck2 size={23} />
          </div>

          <div>
            <span>
              คะแนนล่าสุด
            </span>

            <strong>
              {isLoading
                ? "..."
                : latestBaseScore !== null
                  ? `${latestBaseScore}/100`
                  : "—"}
            </strong>
          </div>
        </article>
      </section>
      {latestCompletedAnalysis && (
        <section className="latest-analysis">
          <div className="latest-analysis__content">
            <div className="latest-analysis__icon">
              <Sparkles size={22} />
            </div>

            <div>
              <span className="latest-analysis__label">
                Latest Analysis
              </span>

              <h2>
                {latestCompletedAnalysis.baseResumeScore !== null
                  ? `${latestCompletedAnalysis.baseResumeScore}/100`
                  : "Analysis completed"}
              </h2>

              <p>
                การวิเคราะห์ Resume ล่าสุดของคุณเสร็จเรียบร้อยแล้ว
              </p>
            </div>
          </div>

          <Link
            className="latest-analysis__button"
            to={`/analyses/${latestCompletedAnalysis.id}`}
          >
            View Analysis
          </Link>
        </section>
      )}

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
                      {formatDate(
                        resume.createdAt,
                      )}
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
                  {resumeToDelete && (
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