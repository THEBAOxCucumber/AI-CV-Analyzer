import {
  useEffect,
  useState,
} from "react"

import {
  BriefcaseBusiness,
  Sparkles,
} from "lucide-react"

import {
  useNavigate,
} from "react-router-dom"

import {
  getResumes,
} from "../services/resume.service"

import {
  createJobDescription,
} from "../services/job-description.service"

import {
  startJobMatchAnalysis,
} from "../services/analysis.service"

import type {
  Resume,
} from "../types/resume"

import "../styles/pages/JobMatchPage.css"

export function JobMatchPage() {
  const navigate = useNavigate()

  const [resumes, setResumes] =
    useState<Resume[]>([])

  const [resumeId, setResumeId] =
    useState("")

  const [title, setTitle] =
    useState("")

  const [company, setCompany] =
    useState("")

  const [description, setDescription] =
    useState("")

  const [loading, setLoading] =
    useState(true)

  const [submitting, setSubmitting] =
    useState(false)

  const [error, setError] =
    useState("")

  useEffect(() => {
    let active = true

    async function loadResumes() {
      try {
        const response =
          await getResumes()

        if (!active) return

        setResumes(
          response.data.resumes,
        )
      } catch {
        if (!active) return

        setError(
          "ไม่สามารถโหลด Resume ได้",
        )
      } finally {
        if (active) {
          setLoading(false)
        }
      }
    }

    void loadResumes()

    return () => {
      active = false
    }
  }, [])

  async function handleSubmit(
    event: React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const selectedResumeId =
      Number(resumeId)

    if (
      !Number.isInteger(
        selectedResumeId,
      ) ||
      selectedResumeId <= 0
    ) {
      setError(
        "กรุณาเลือก Resume",
      )
      return
    }

    if (!description.trim()) {
      setError(
        "กรุณาระบุ Job Description",
      )
      return
    }

    setSubmitting(true)
    setError("")

    try {
      const jobResponse =
        await createJobDescription({
          title:
            title.trim() ||
            undefined,
          company:
            company.trim() ||
            undefined,
          description:
            description.trim(),
        })

      const jobDescriptionId =
        jobResponse.data
          .jobDescription.id

      const analysisResponse =
        await startJobMatchAnalysis(
          selectedResumeId,
          jobDescriptionId,
        )

      navigate(
        `/analyses/${analysisResponse.data.analysisRun.id}`,
      )
    } catch {
      setError(
        "ไม่สามารถเริ่ม Job Match ได้ กรุณาลองใหม่",
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <main className="job-match-page">
      <header className="job-match-header">
        <div>
          <span className="job-match-header__eyebrow">
            AI Job Matching
          </span>

          <h1>Job Match</h1>

          <p>
            เปรียบเทียบ Resume
            ของคุณกับตำแหน่งงานที่สนใจ
          </p>
        </div>

        <div className="job-match-header__icon">
          <BriefcaseBusiness size={24} />
        </div>
      </header>

      <section className="job-match-card">
        {loading ? (
          <p className="job-match-status">
            กำลังโหลด Resume...
          </p>
        ) : resumes.length === 0 ? (
          <div className="job-match-empty">
            <h2>
              ยังไม่มี Resume
            </h2>

            <p>
              อัปโหลด Resume ก่อนเริ่ม
              Job Match
            </p>

            <button
              type="button"
              onClick={() => {
                navigate(
                  "/resumes/upload",
                )
              }}
            >
              Upload Resume
            </button>
          </div>
        ) : (
          <form
            className="job-match-form"
            onSubmit={handleSubmit}
          >
            <div className="job-match-field">
              <label htmlFor="resume">
                Resume
              </label>

              <select
                id="resume"
                value={resumeId}
                disabled={submitting}
                onChange={(event) => {
                  setResumeId(
                    event.target.value,
                  )
                }}
              >
                <option value="">
                  เลือก Resume
                </option>

                {resumes.map(
                  (resume) => (
                    <option
                      key={resume.id}
                      value={resume.id}
                    >
                      {resume.originalName}
                    </option>
                  ),
                )}
              </select>
            </div>

            <div className="job-match-form__row">
              <div className="job-match-field">
                <label htmlFor="job-title">
                  Job Title
                </label>

                <input
                  id="job-title"
                  type="text"
                  value={title}
                  disabled={submitting}
                  placeholder="เช่น Frontend Developer"
                  onChange={(event) => {
                    setTitle(
                      event.target.value,
                    )
                  }}
                />
              </div>

              <div className="job-match-field">
                <label htmlFor="company">
                  Company
                </label>

                <input
                  id="company"
                  type="text"
                  value={company}
                  disabled={submitting}
                  placeholder="ชื่อบริษัท"
                  onChange={(event) => {
                    setCompany(
                      event.target.value,
                    )
                  }}
                />
              </div>
            </div>

            <div className="job-match-field">
              <label htmlFor="job-description">
                Job Description
              </label>

              <textarea
                id="job-description"
                value={description}
                disabled={submitting}
                rows={10}
                required
                placeholder="วางรายละเอียดงานที่นี่..."
                onChange={(event) => {
                  setDescription(
                    event.target.value,
                  )
                }}
              />
            </div>

            {error && (
              <p
                className="job-match-error"
                role="alert"
              >
                {error}
              </p>
            )}

            <button
              className="job-match-submit"
              type="submit"
              disabled={submitting}
            >
              <Sparkles size={18} />

              {submitting
                ? "กำลังวิเคราะห์..."
                : "Analyze Job Match"}
            </button>
          </form>
        )}
      </section>
    </main>
  )
}