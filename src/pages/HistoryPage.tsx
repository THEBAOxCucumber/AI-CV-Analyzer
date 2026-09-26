import {
  AlertCircle,
  ChevronRight,
  Clock3,
  FileSearch,
  LoaderCircle,
  Trash2,
} from "lucide-react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import {
  formatThaiDateTime,
} from "../utils/date-time"

import {
  getAnalysisScore,
  getAnalysisTypeLabel,
} from "../utils/analysis"

import {
  deleteAnalysisRun,
  getResumeAnalysisHistory,
} from "../services/analysis.service"

import {
  ApiError,
} from "../services/api"

import {
  getResumes,
  deleteResume,
} from "../services/resume.service"

import type {
  ResumeAnalysisRun,
} from "../types/analysis"

import type {
  Resume,
} from "../types/resume"

import "../styles/pages/HistoryPage.css"

interface HistoryItem {
  analysis: ResumeAnalysisRun
  resume: Resume
}


export function HistoryPage() {
  const navigate = useNavigate()

  const [items, setItems] =
    useState<HistoryItem[]>([])

  const [isLoading, setIsLoading] =
    useState(true)

  const [error, setError] =
    useState("")

  const [
    analysisToDelete,
    setAnalysisToDelete,
  ] = useState<HistoryItem | null>(
    null,
  )

  const [
    isDeleting,
    setIsDeleting,
  ] = useState(false)

  const [
    deleteError,
    setDeleteError,
  ] = useState("")

  useEffect(() => {
    let cancelled = false

    async function loadHistory() {
      try {
        const resumesResponse =
          await getResumes()

        if (cancelled) {
          return
        }

        const resumes =
          resumesResponse.data.resumes

        if (resumes.length === 0) {
          setItems([])
          setError("")
          setIsLoading(false)
          return
        }

        const historyResponses =
          await Promise.all(
            resumes.map(
              async (resume) => {
                const response =
                  await getResumeAnalysisHistory(
                    resume.id,
                  )

                return response.data.analyses.map(
                  (analysis) => ({
                    analysis,
                    resume,
                  }),
                )
              },
            ),
          )

        if (cancelled) {
          return
        }

        const historyItems =
          historyResponses
            .flat()
            .sort(
              (a, b) =>
                new Date(
                  b.analysis.createdAt,
                ).getTime() -
                new Date(
                  a.analysis.createdAt,
                ).getTime(),
            )

        setItems(historyItems)
        setError("")
        setIsLoading(false)
      } catch (loadError) {
        if (cancelled) {
          return
        }

        setIsLoading(false)

        if (
          loadError instanceof ApiError
        ) {
          setError(
            loadError.message,
          )
        } else {
          setError(
            "ไม่สามารถโหลดประวัติการวิเคราะห์ได้",
          )
        }
      }
    }

    void loadHistory()

    return () => {
      cancelled = true
    }
  }, [])

  async function handleDeleteAnalysis() {
    if (!analysisToDelete) {
      return
    }

    const {
      analysis,
      resume,
    } = analysisToDelete

    try {
      setIsDeleting(true)
      setDeleteError("")

      await deleteAnalysisRun(
        analysis.id,
      )

      setItems((currentItems) =>
        currentItems.filter(
          (item) =>
            item.analysis.id !==
            analysis.id,
        ),
      )

      /*
       * ไม่เหลือ Analysis ของ Resume นี้แล้ว
       * → ลบ Resume ด้วย
       *
       * เช็กจาก server ไม่ใช่ items บนหน้า
       * กันกรณีมี Analysis ใหม่จากแท็บอื่น
       */
      try {
        const remaining =
          await getResumeAnalysisHistory(
            resume.id,
            1,
          )

        if (
          remaining.data.analyses.length === 0
        ) {
          await deleteResume(resume.id)
        }
      } catch {
        setDeleteError(
          "ลบ Analysis แล้ว แต่ลบ Resume ไม่สำเร็จ กรุณาลบ Resume จากหน้า Dashboard",
        )
        return
      }

      setAnalysisToDelete(null)
    } catch (deleteAnalysisError) {
      if (
        deleteAnalysisError instanceof
        ApiError
      ) {
        setDeleteError(
          deleteAnalysisError.message,
        )
      } else {
        setDeleteError(
          "ไม่สามารถลบประวัติการวิเคราะห์ได้",
        )
      }
    } finally {
      setIsDeleting(false)
    }
  }

  const isLastAnalysisOfResume =
    analysisToDelete !== null &&
    items.filter(
      (item) =>
        item.resume.id ===
        analysisToDelete.resume.id,
    ).length === 1

  if (isLoading) {
    return (
      <main className="history-page">
        <div className="history-state">
          <LoaderCircle
            className="history-spinner"
            size={36}
          />

          <h2>
            กำลังโหลด History
          </h2>

          <p>
            กำลังดึงประวัติการวิเคราะห์ของคุณ
          </p>
        </div>
      </main>
    )
  }

  if (error) {
    return (
      <main className="history-page">
        <div className="history-state history-state--error">
          <AlertCircle size={36} />

          <h2>
            โหลด History ไม่สำเร็จ
          </h2>

          <p>{error}</p>
        </div>
      </main>
    )
  }

  return (
    <main className="history-page">
      <header className="history-header">
        <div>
          <p className="history-eyebrow">
            Resume Analysis
          </p>

          <h1>
            Analysis History
          </h1>

          <p>
            ดูผลการวิเคราะห์ Resume
            ที่เคยสร้างไว้
          </p>
        </div>

        <div className="history-count">
          <Clock3 size={18} />

          <span>
            {items.length} Analyses
          </span>
        </div>
      </header>

      {items.length === 0 ? (
        <section className="history-state">
          <FileSearch size={40} />

          <h2>
            ยังไม่มีประวัติการวิเคราะห์
          </h2>

          <p>
            เมื่อวิเคราะห์ Resume แล้ว
            ผลจะแสดงที่หน้านี้
          </p>

          <button
            className="history-empty-button"
            type="button"
            onClick={() =>
              navigate(
                "/resumes/upload",
              )
            }
          >
            Upload Resume
          </button>
        </section>
      ) : (
        <section className="history-card">
          <div className="history-table-wrapper">
            <table className="history-table">
              <thead>
                <tr>
                  <th>Resume</th>
                  <th>Analysis</th>
                  <th>Job</th>
                  <th>Status</th>
                  <th>Score</th>
                  <th>Date</th>
                  <th>
                    <span className="history-sr-only">
                      Open
                    </span>
                  </th>
                </tr>
              </thead>

              <tbody>
                {items.map(
                  ({
                    analysis,
                    resume,
                  }) => (
                    <tr
                      key={
                        analysis.id
                      }
                      className="history-table__row"
                      tabIndex={0}
                      onClick={() =>
                        navigate(
                          `/analyses/${analysis.id}`,
                        )
                      }
                      onKeyDown={(
                        event,
                      ) => {
                        if (
                          event.key ===
                          "Enter" ||
                          event.key ===
                          " "
                        ) {
                          event.preventDefault()

                          navigate(
                            `/analyses/${analysis.id}`,
                          )
                        }
                      }}
                    >
                      <td>
                        <div className="history-resume">
                          <div className="history-resume__icon">
                            <FileSearch
                              size={18}
                            />
                          </div>

                          <div>
                            <strong>
                              {
                                resume.originalName
                              }
                            </strong>

                            <span>
                              Resume #
                              {resume.id}
                            </span>
                          </div>
                        </div>
                      </td>

                      <td>
                        {getAnalysisTypeLabel(
                          analysis.analysisType,
                        )}
                      </td>

                      <td>
                        {analysis.job ? (
                          <div className="history-job">
                            <strong>
                              {analysis.job.title}
                            </strong>

                            <span>
                              {analysis.job.company ??
                                "ไม่ระบุบริษัท"}
                            </span>

                            {analysis.job.location && (
                              <small>
                                {analysis.job.location}
                              </small>
                            )}
                          </div>
                        ) : (
                          <span className="history-empty">
                            —
                          </span>
                        )}
                      </td>

                      <td>
                        <span
                          className={`history-status history-status--${analysis.status.toLowerCase()}`}
                        >
                          {
                            analysis.status
                          }
                        </span>
                      </td>

                      <td>
                        {(() => {
                          const score =
                            getAnalysisScore(analysis)

                          return (
                            <strong className="history-score">
                              {score !== null
                                ? `${score}/100`
                                : "—"}
                            </strong>
                          )
                        })()}
                      </td>

                      <td>
                        {resume.createdAt
  ? formatThaiDateTime(
      resume.createdAt,
    )
  : "-"}
                      </td>

                      <td className="history-actions">
                        <button
                          type="button"
                          className="history-delete-button"
                          aria-label="Delete analysis"
                          disabled={
                            analysis.status ===
                            "PENDING" ||
                            analysis.status ===
                            "QUEUED" ||
                            analysis.status ===
                            "PROCESSING"
                          }
                          onClick={(event) => {
                            event.stopPropagation()

                            setDeleteError("")
                            setAnalysisToDelete({
                              analysis,
                              resume,
                            })
                          }}
                          onKeyDown={(event) => {
                            event.stopPropagation()
                          }}
                        >
                          <Trash2 size={17} />
                        </button>

                        <ChevronRight
                          size={19}
                        />
                      </td>
                    </tr>
                  ),
                )}
              </tbody>
            </table>
          </div>
        </section>
            )}

      {analysisToDelete && (
        <div
          className="history-modal-backdrop"
          role="presentation"
          onMouseDown={() => {
            if (!isDeleting) {
              setAnalysisToDelete(null)
              setDeleteError("")
            }
          }}
        >
          <div
            className="history-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-analysis-title"
            onMouseDown={(event) => {
              event.stopPropagation()
            }}
          >
            <div className="history-modal__icon">
              <Trash2 size={22} />
            </div>

            <h2 id="delete-analysis-title">
              ลบ Analysis History?
            </h2>

            <p>
              คุณต้องการลบผลการวิเคราะห์ของ{" "}
              <strong>
                {
                  analysisToDelete.resume
                    .originalName
                }
              </strong>{" "}
              ใช่หรือไม่
            </p>

            {analysisToDelete.analysis
              .analysisType ===
              "JOB_MATCH" &&
              analysisToDelete.analysis
                .job && (
                <p className="history-modal__job">
                  Job:{" "}
                  <strong>
                    {
                      analysisToDelete
                        .analysis.job.title
                    }
                  </strong>
                </p>
              )}

            <p className="history-modal__warning">
              เมื่อลบแล้วจะไม่สามารถกู้คืน
              Analysis นี้ได้
            </p>

            {isLastAnalysisOfResume && (
              <p className="history-modal__warning">
                นี่คือ Analysis สุดท้ายของ Resume นี้
                — Resume จะถูกลบออกจากระบบด้วย
              </p>
            )}

            {deleteError && (
              <p
                className="history-modal__error"
                role="alert"
              >
                {deleteError}
              </p>
            )}

            <div className="history-modal__actions">
              <button
                type="button"
                className="history-modal__cancel"
                disabled={isDeleting}
                onClick={() => {
                  setAnalysisToDelete(null)
                  setDeleteError("")
                }}
              >
                Cancel
              </button>

              <button
                type="button"
                className="history-modal__delete"
                disabled={isDeleting}
                onClick={() => {
                  void handleDeleteAnalysis()
                }}
              >
                {isDeleting
                  ? "กำลังลบ..."
                  : "Delete Analysis"}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  )
}