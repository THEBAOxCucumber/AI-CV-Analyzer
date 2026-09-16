import {
  FileCheck2,
  FileText,
  Plus,
  Sparkles,
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
  getResumes,
} from "../services/resume.service"

import type {
  Resume,
} from "../types/resume"

import "./DashboardPage.css"

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

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  useEffect(() => {
    let cancelled = false

    async function loadDashboard() {
      try {
        const response =
          await getResumes()

        if (!cancelled) {
          setResumes(
            response.data.resumes,
          )
        }
      } catch {
        if (!cancelled) {
          setError(
            "ไม่สามารถโหลดข้อมูล Resume ได้",
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

  const completedCount =
    resumes.filter(
      (resume) =>
        resume.status ===
        "COMPLETED",
    ).length

  const recentResumes =
    resumes.slice(0, 5)

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
        aria-label="Resume statistics"
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
            <FileCheck2 size={23} />
          </div>

          <div>
            <span>
              พร้อมใช้งาน
            </span>

            <strong>
              {isLoading
                ? "..."
                : completedCount}
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
              —
            </strong>
          </div>
        </article>
      </section>

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
                </article>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  )
}