import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  useNavigate,
  useSearchParams,
} from "react-router-dom"

import {
  BriefcaseBusiness,
  ExternalLink,
  LoaderCircle,
  MapPin,
  Search,
  Sparkles,
} from "lucide-react"

import {
  importJob,
  searchJobs,
} from "../services/job.service"

import {
  getResumeAnalysisHistory,
  startBaseAnalysis,
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

/*
 * ไม่มีคำค้นตั้งต้น (เดิม "Software Developer" ทำให้ผู้ใช้สับสน)
 * คำค้น: ?q= จากลิงก์ในหน้าผลวิเคราะห์ หรือตำแหน่งที่ AI แนะนำจาก Resume ที่เลือก
 */
export function JobMatchesPage() {
  const [searchParams] =
    useSearchParams()

  const initialKeywords =
    searchParams.get("q")?.trim() ?? ""

  // ref: อ่านครั้งเดียวตอนเปิดหน้า
  const initialResumeId = useRef(
    Number(searchParams.get("resume")) || null,
  )

  const [
    searchInput,
    setSearchInput,
  ] = useState(initialKeywords)

  const [
    activeKeywords,
    setActiveKeywords,
  ] = useState(initialKeywords)

  // ตำแหน่งที่ AI แนะนำจากผลวิเคราะห์ล่าสุดของ Resume ที่เลือก
  const [
    suggestedTitles,
    setSuggestedTitles,
  ] = useState<string[]>([])

  const [
    suggestionsReady,
    setSuggestionsReady,
  ] = useState(false)

  const [
    isStartingAnalysis,
    setIsStartingAnalysis,
  ] = useState(false)

  // ผู้ใช้ค้นเอง (พิมพ์ / มาจากลิงก์) → ไม่เอาตำแหน่งแนะนำมาทับ
  const userChoseKeywords =
    useRef(initialKeywords !== "")

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
    isFetching,
    setIsLoading,
  ] = useState(initialKeywords !== "")

  /*
   * ไม่มีคำค้น = ไม่ได้ค้นอยู่ (คำค้นถูกล้างระหว่างค้น → effect ยกเลิก
   * โดยไม่ปิด isFetching จึงคิดจากคำค้นด้วย)
   */
  const hasKeywords =
    activeKeywords.trim() !== ""

  const isLoading =
    isFetching && hasKeywords


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
        // Resume จากลิงก์ (?resume=) ถ้าเป็นของผู้ใช้ ไม่งั้นอันล่าสุด
        const fromLink =
          resumeList.find(
            (resume) =>
              resume.id === initialResumeId.current,
          )

        setSelectedResumeId(
          (fromLink ?? resumeList[0]).id,
        )
      } else {
        setSuggestionsReady(true)
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

  /*
   * ตำแหน่งที่ AI แนะนำ: จากผลวิเคราะห์ล่าสุดของ Resume ที่เลือกที่มีตำแหน่ง
   * ผู้ใช้ยังไม่ได้ค้นเอง → ค้นตำแหน่งแรกให้อัตโนมัติ
   */
  useEffect(() => {
    if (selectedResumeId === null) {
      return
    }

    let cancelled = false

    async function loadSuggestions(
      resumeId: number,
    ) {
      setSuggestionsReady(false)

      try {
        const response =
          await getResumeAnalysisHistory(
            resumeId,
            20,
          )

        if (cancelled) {
          return
        }

        // ประวัติเรียงใหม่สุดก่อน
        const titles =
          response.data.analyses.find(
            (analysis) =>
              analysis.status === "COMPLETED" &&
              (analysis.suggestedJobTitles?.length ?? 0) > 0,
          )?.suggestedJobTitles ?? []

        setSuggestedTitles(titles)

        if (!userChoseKeywords.current) {
          setSearchInput(titles[0] ?? "")
          setActiveKeywords(titles[0] ?? "")
        }
      } catch {
        if (!cancelled) {
          setSuggestedTitles([])
        }
      } finally {
        if (!cancelled) {
          setSuggestionsReady(true)
        }
      }
    }

    void loadSuggestions(selectedResumeId)

    return () => {
      cancelled = true
    }
  }, [selectedResumeId])

  useEffect(() => {
    // ยังไม่มีคำค้น → ไม่ค้น (หน้าจอซ่อนผลเก่าเองด้วย hasKeywords)
    if (!activeKeywords.trim()) {
      return
    }

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
      React.SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    const keywords =
      searchInput.trim()

    if (!keywords) {
      return
    }

    userChoseKeywords.current = true
    setActiveKeywords(keywords)
  }

  function handlePickSuggestion(
    title: string,
  ) {
    userChoseKeywords.current = true
    setSearchInput(title)
    setActiveKeywords(title)
  }

  /*
   * Resume ยังไม่มีตำแหน่งแนะนำ → วิเคราะห์ใหม่ (prompt ใหม่ให้ตำแหน่งมาด้วย)
   */
  async function handleAnalyzeResume() {
    if (!selectedResumeId) {
      return
    }

    try {
      setAnalysisError(null)
      setIsStartingAnalysis(true)

      const response =
        await startBaseAnalysis(
          selectedResumeId,
        )

      navigate(
        `/analyses/${response.data.analysisRun.id}`,
      )
    } catch (caughtError) {
      setAnalysisError(
        caughtError instanceof Error
          ? caughtError.message
          : "ไม่สามารถเริ่มวิเคราะห์ Resume ได้",
      )
    } finally {
      setIsStartingAnalysis(false)
    }
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
            โอกาสงาน
          </p>

          <h1>หางานที่เหมาะกับคุณ</h1>

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
      อัปโหลด Resume
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
          {isLoading && (
            <LoaderCircle
              className="job-spinner"
              size={18}
              aria-hidden="true"
            />
          )}
          {isLoading
            ? "กำลังค้นหา..."
            : "ค้นหางาน"}
        </button>
      </form>

      {suggestedTitles.length > 0 && (
        <div className="job-suggestion-chips">
          <span className="job-suggestion-chips__label">
            <Sparkles
              size={16}
              aria-hidden="true"
            />
            เหมาะกับ Resume นี้:
          </span>

          {suggestedTitles.map((title) => (
            <button
              key={title}
              type="button"
              className="job-suggestion-chip"
              aria-pressed={
                title === activeKeywords.trim()
              }
              onClick={() =>
                handlePickSuggestion(title)
              }
            >
              {title}
            </button>
          ))}
        </div>
      )}

      {!hasKeywords &&
        !suggestionsReady && (
          <output className="job-loading-note">
            <LoaderCircle
              className="job-spinner"
              size={16}
              aria-hidden="true"
            />
            กำลังหาตำแหน่งงานที่เหมาะกับ Resume…
          </output>
        )}

      {!hasKeywords &&
        suggestionsReady && (
          <section className="job-state-card">
            <Sparkles
              size={32}
              aria-hidden="true"
            />

            {resumes.length === 0 ? (
              <>
                <h2>
                  อัปโหลด Resume เพื่อให้ AI แนะนำงาน
                </h2>

                <p>
                  เมื่อวิเคราะห์ Resume แล้ว หน้านี้จะค้นหางานที่เหมาะกับคุณให้อัตโนมัติ
                  หรือพิมพ์ตำแหน่งที่สนใจในช่องค้นหาด้านบน
                </p>
              </>
            ) : (
              <>
                <h2>
                  Resume นี้ยังไม่มีตำแหน่งที่ AI แนะนำ
                </h2>

                <p>
                  วิเคราะห์ Resume ให้ AI แนะนำตำแหน่งงานที่เหมาะ
                  หรือพิมพ์ตำแหน่งที่สนใจในช่องค้นหาด้านบน
                </p>

                <button
                  type="button"
                  onClick={() =>
                    void handleAnalyzeResume()
                  }
                  disabled={isStartingAnalysis}
                >
                  {isStartingAnalysis
                    ? "กำลังเริ่มวิเคราะห์..."
                    : "วิเคราะห์ Resume นี้"}
                </button>
              </>
            )}
          </section>
        )}

      {!isLoading &&
        !error &&
        hasKeywords && (
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

      {hasKeywords && error && (
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
        <>
          <output className="job-loading-note">
            <LoaderCircle
              className="job-spinner"
              size={16}
              aria-hidden="true"
            />
            กำลังค้นหางานจาก Careerjet — อาจใช้เวลาถึง 15 วินาที
          </output>

          <section
            className="job-list"
            aria-hidden="true"
          >
            {[0, 1, 2, 3, 4, 5].map((index) => (
              <article key={index} className="job-card job-card--skeleton">
                <div className="job-card__content">
                  <span className="skeleton" style={{ width: 44, height: 44, flex: "0 0 auto" }} />
                  <div className="job-skeleton__text">
                    <span className="skeleton" style={{ width: "72%", height: 16 }} />
                    <span className="skeleton" style={{ width: "45%", height: 12 }} />
                    <span className="skeleton" style={{ width: "100%", height: 12, marginTop: 8 }} />
                    <span className="skeleton" style={{ width: "88%", height: 12 }} />
                  </div>
                </div>
                <div className="job-card__actions">
                  <span className="skeleton" style={{ flex: 1, height: 42 }} />
                  <span className="skeleton" style={{ width: 110, height: 42 }} />
                </div>
              </article>
            ))}
          </section>
        </>
      )}

      {!isLoading &&
        !error &&
        hasKeywords &&
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
              ลองใช้คำค้นที่กว้างขึ้น เช่น
              React หรือ UX UI Designer
            </p>
          </section>
        )}

      {!isLoading &&
        !error &&
        hasKeywords &&
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
    title={
      selectedResumeId
        ? undefined
        : "เลือก Resume ด้านบนก่อน"
    }
    onClick={() =>
      void handleAnalyzeJob(job)
    }
  >
    {analyzingJobId ===
      job.externalJobId && (
      <LoaderCircle
        className="job-spinner"
        size={16}
        aria-hidden="true"
      />
    )}
    {analyzingJobId ===
    job.externalJobId
      ? "กำลังวิเคราะห์..."
      : "วิเคราะห์ความเหมาะสม"}
  </button>

  <a
    className="job-card__action"
    href={job.sourceUrl}
    target="_blank"
    rel="noreferrer"
  >
    ดูประกาศงาน

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
        ข้อมูลตำแหน่งงานจาก Careerjet
      </p>
    </main>
  )
}