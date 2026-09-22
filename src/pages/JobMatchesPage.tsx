import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import {
  BriefcaseBusiness,
  ExternalLink,
  MapPin,
  Search,
} from "lucide-react"

import {
  importJob,
  searchJobs,
} from "../services/job.service"

import {
  startJobMatchAnalysis,
} from "../services/analysis.service"

import {
  getResumes,
} from "../services/resume.service"

import type {
  Job,
} from "../types/job"

import type {
  Resume,
} from "../types/resume"

import "../styles/pages/JobMatchesPage.css"

const DEFAULT_KEYWORDS =
  "Software Developer"

export function JobMatchesPage() {
  const [
    searchInput,
    setSearchInput,
  ] = useState(DEFAULT_KEYWORDS)

  const [
    activeKeywords,
    setActiveKeywords,
  ] = useState(DEFAULT_KEYWORDS)

  const navigate =
  useNavigate()

const [
  resumes,
  setResumes,
] = useState<Resume[]>([])

const [
  selectedResumeId,
  setSelectedResumeId,
] = useState<number | null>(
  null,
)

const [
  analyzingJobId,
  setAnalyzingJobId,
] = useState<string | null>(
  null,
)

const [
  analysisError,
  setAnalysisError,
] = useState<string | null>(
  null,
)

  const [
    jobs,
    setJobs,
  ] = useState<Job[]>([])

  const [
    totalCount,
    setTotalCount,
  ] = useState(0)

  const [
    isLoading,
    setIsLoading,
  ] = useState(true)
  

  const [
    error,
    setError,
  ] = useState<string | null>(
    null,
  )

  useEffect(() => {
  let cancelled = false

  async function loadResumes() {
    try {
      const response =
        await getResumes()

      if (cancelled) {
        return
      }

      const resumeList =
        response.data.resumes

      setResumes(resumeList)

      if (resumeList.length > 0) {
        setSelectedResumeId(
          resumeList[0].id,
        )
      }
    } catch (caughtError) {
      if (cancelled) {
        return
      }

      setAnalysisError(
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถโหลด Resume ได้",
      )
    }
  }

  void loadResumes()

  return () => {
    cancelled = true
  }
}, [])

  useEffect(() => {
    let cancelled = false

    async function loadJobs() {
      try {
        setIsLoading(true)
        setError(null)

        const response =
          await searchJobs({
            keywords:
              activeKeywords,
            location: "Thailand",
            page: 1,
            pageSize: 10,
          })

        if (cancelled) {
          return
        }

        setJobs(
          response.data.jobs,
        )

        setTotalCount(
          response.data.totalCount,
        )
      } catch (caughtError) {
        if (cancelled) {
          return
        }

        setJobs([])
        setTotalCount(0)

        setError(
          caughtError instanceof Error
            ? caughtError.message
            : "ไม่สามารถค้นหางานได้",
        )
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void loadJobs()

    return () => {
      cancelled = true
    }
  }, [activeKeywords])

  function handleSubmit(
    event:
      React.FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const keywords =
      searchInput.trim()

    if (!keywords) {
      return
    }

    setActiveKeywords(keywords)
  }
  async function handleAnalyzeJob(
  job: Job,
) {
  if (!selectedResumeId) {
    setAnalysisError(
      "กรุณาเลือก Resume ก่อนวิเคราะห์ Job Match",
    )
    return
  }

  try {
    setAnalysisError(null)

    setAnalyzingJobId(
      job.externalJobId,
    )

    const imported =
  await importJob({
    externalJobId:
      job.externalJobId,

    title:
      job.title,

    company:
      job.company,

    description:
      job.description,

    location:
      job.location,

    salary:
      job.salary,

    postedAt:
      job.postedAt,

    sourceUrl:
      job.sourceUrl,

    source:
      job.source,
  })

    const analysis =
      await startJobMatchAnalysis(
        selectedResumeId,
        imported.data
          .jobDescription.id,
      )

    navigate(
      `/analyses/${analysis.data.analysisRun.id}`,
    )
  } catch (caughtError) {
    setAnalysisError(
      caughtError instanceof Error
        ? caughtError.message
        : "ไม่สามารถเริ่ม Job Match Analysis ได้",
    )
  } finally {
    setAnalyzingJobId(null)
  }
}

  return (
    <main className="job-matches-page">
      <header className="job-matches-header">
        <div>
          <p className="job-matches-eyebrow">
            Career Opportunities
          </p>

          <h1>Job Matches</h1>

          <p className="job-matches-subtitle">
            ค้นหาตำแหน่งงานในประเทศไทย
            ที่ตรงกับสายงานของคุณ
          </p>
        </div>
      </header>

      <section className="job-resume-selector">
  <div>
    <label htmlFor="job-match-resume">
      Resume สำหรับวิเคราะห์
    </label>

    <p>
      เลือก Resume ที่ต้องการใช้เปรียบเทียบกับตำแหน่งงาน
    </p>
  </div>

  {resumes.length > 0 ? (
    <select
      id="job-match-resume"
      value={
        selectedResumeId ?? ""
      }
      onChange={(event) =>
        setSelectedResumeId(
          Number(
            event.target.value,
          ),
        )
      }
    >
      {resumes.map((resume) => (
        <option
          key={resume.id}
          value={resume.id}
        >
          {resume.originalName}
        </option>
      ))}
    </select>
  ) : (
    <button
      type="button"
      onClick={() =>
        navigate(
          "/resumes/upload",
        )
      }
    >
      Upload Resume
    </button>
  )}
</section>

{analysisError && (
  <div
    className="job-analysis-error"
    role="alert"
  >
    {analysisError}
  </div>
)}

      <form
        className="job-search"
        onSubmit={handleSubmit}
      >
        <div className="job-search__input">
          <Search
            size={20}
            aria-hidden="true"
          />

          <input
            type="search"
            value={searchInput}
            onChange={(event) =>
              setSearchInput(
                event.target.value,
              )
            }
            placeholder="เช่น Frontend Developer"
            aria-label="ค้นหาตำแหน่งงาน"
          />
        </div>

        <button
          className="job-search__button"
          type="submit"
          disabled={isLoading}
        >
          {isLoading
            ? "กำลังค้นหา..."
            : "Search Jobs"}
        </button>
      </form>

      {!isLoading &&
        !error && (
          <div className="job-results-summary">
            <div>
              <strong>
                {activeKeywords}
              </strong>

              <span>
                {" "}
                ในประเทศไทย
              </span>
            </div>

            <span>
              พบ{" "}
              {totalCount.toLocaleString()}
              {" "}ตำแหน่ง
            </span>
          </div>
        )}

      {error && (
        <section className="job-state-card">
          <h2>
            ไม่สามารถโหลดงานได้
          </h2>

          <p>{error}</p>

          <button
            type="button"
            onClick={() =>
              setActiveKeywords(
                `${searchInput.trim()} `,
              )
            }
          >
            ลองอีกครั้ง
          </button>
        </section>
      )}

      {isLoading && (
        <section className="job-state-card">
          <div className="job-loading-spinner" />

          <h2>
            กำลังค้นหางาน...
          </h2>

          <p>
            กำลังโหลดตำแหน่งงานจาก
            Careerjet
          </p>
        </section>
      )}

      {!isLoading &&
        !error &&
        jobs.length === 0 && (
          <section className="job-state-card">
            <BriefcaseBusiness
              size={32}
              aria-hidden="true"
            />

            <h2>
              ไม่พบตำแหน่งงาน
            </h2>

            <p>
              ลองใช้คำค้นอื่น เช่น
              Software Developer,
              React หรือ UX UI Designer
            </p>
          </section>
        )}

      {!isLoading &&
        !error &&
        jobs.length > 0 && (
          <section
            className="job-list"
            aria-label="ผลการค้นหางาน"
          >
            {jobs.map(
              (job) => (
                <article
                  className="job-card"
                  key={job.externalJobId}
                >
                  <div className="job-card__content">
                    <div className="job-card__icon">
                      <BriefcaseBusiness
                        size={22}
                        aria-hidden="true"
                      />
                    </div>

                    <div className="job-card__details">
                      <h2>
                        {job.title}
                      </h2>

                      <p className="job-card__company">
                        {job.company ??
                          "ไม่ระบุบริษัท"}
                      </p>

                      <div className="job-card__meta">
                        {job.location && (
                          <span>
                            <MapPin
                              size={16}
                              aria-hidden="true"
                            />

                            {job.location}
                          </span>
                        )}

                        {job.salary && (
                          <span className="job-card__salary">
                            {job.salary}
                          </span>
                        )}
                      </div>

                      {job.description && (
                        <p className="job-card__description">
                          {job.description}
                        </p>
                      )}
                    </div>
                  </div>

                  <div className="job-card__actions">
  <button
    type="button"
    className="job-card__match"
    disabled={
      !selectedResumeId ||
      analyzingJobId ===
        job.externalJobId
    }
    onClick={() =>
      void handleAnalyzeJob(job)
    }
  >
    {analyzingJobId ===
    job.externalJobId
      ? "Analyzing..."
      : "Analyze Match"}
  </button>

  <a
    className="job-card__action"
    href={job.sourceUrl}
    target="_blank"
    rel="noreferrer"
  >
    View Job

    <ExternalLink
      size={16}
      aria-hidden="true"
    />
  </a>
</div>
                </article>
              ),
            )}
          </section>
        )}

      <p className="job-source">
        Job listings provided by Careerjet
      </p>
    </main>
  )
}