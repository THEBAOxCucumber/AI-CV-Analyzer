import {
  AlertCircle,
  CheckCircle2,
  ChevronRight,
  Clock3,
  FileSearch,
  LoaderCircle,
  Trash2,
  XCircle,
  type LucideIcon,
} from "lucide-react"

import type {
  CSSProperties,
} from "react"

import {
  useEffect,
  useState,
} from "react"

import {
  useNavigate,
} from "react-router-dom"

import {
  formatThaiDate,
  formatThaiTime,
} from "../utils/date-time"

import {
  getAnalysisScore,
  getAnalysisTypeLabel,
} from "../utils/analysis"

import {
  getScoreTone,
} from "../utils/dashboard-stats"

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

import {
  ModalDialog,
} from "../components/ui/ModalDialog"

/*
 * ป้ายสถานะ: ไอคอน + ข้อความ (ไม่ใช้สีอย่างเดียว)
 */
const STATUS_META: Record<
  ResumeAnalysisRun["status"],
  { label: string; icon: LucideIcon; spin?: boolean }
> = {
  COMPLETED: { label: "สำเร็จ", icon: CheckCircle2 },
  FAILED: { label: "ล้มเหลว", icon: XCircle },
  PENDING: { label: "รอคิว", icon: Clock3 },
  QUEUED: { label: "รอคิว", icon: Clock3 },
  PROCESSING: { label: "กำลังวิเคราะห์", icon: LoaderCircle, spin: true },
}

function StatusBadge({
  status,
}: {
  status: ResumeAnalysisRun["status"]
}) {
  const meta = STATUS_META[status]
  const Icon = meta.icon

  return (
    <span className={`history-status history-status--${status.toLowerCase()}`}>
      <Icon
        size={13}
        className={meta.spin ? "history-status__spin" : undefined}
        aria-hidden="true"
      />
      {meta.label}
    </span>
  )
}

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
        <header className="history-header">
          <div>
            <p className="history-eyebrow">วิเคราะห์ Resume</p>
            <h1>ประวัติการวิเคราะห์</h1>
            <p>ดูผลการวิเคราะห์ Resume ที่เคยสร้างไว้</p>
          </div>
        </header>

        <section
          className="history-card"
          aria-busy="true"
          aria-label="กำลังโหลดประวัติการวิเคราะห์"
        >
          {[0, 1, 2, 3].map((index) => (
            <div key={index} className="history-row history-row--skeleton" aria-hidden="true">
              <div className="history-row__main">
                <span className="skeleton" style={{ width: 40, height: 40 }} />
                <div className="history-skeleton__text">
                  <span className="skeleton" style={{ width: "70%", height: 14 }} />
                  <span className="skeleton" style={{ width: "35%", height: 12 }} />
                </div>
              </div>
              <span className="skeleton" style={{ width: 72, height: 22, borderRadius: 999 }} />
              <span className="skeleton" style={{ width: 48, height: 22 }} />
              <span className="skeleton" style={{ width: 84, height: 16 }} />
              <span />
            </div>
          ))}
        </section>
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
            วิเคราะห์ Resume
          </p>

          <h1>
            ประวัติการวิเคราะห์
          </h1>

          <p>
            ดูผลการวิเคราะห์ Resume
            ที่เคยสร้างไว้
          </p>
        </div>

        <div className="history-count">
          <Clock3 size={18} />

          <span>
            {items.length} รายการ
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
            อัปโหลด Resume
          </button>
        </section>
      ) : (
        <section className="history-card">
          <div
            className="history-list__head"
            aria-hidden="true"
          >
            <span>Resume / การวิเคราะห์</span>
            <span>สถานะ</span>
            <span>คะแนน</span>
            <span>วันที่วิเคราะห์</span>
            <span />
          </div>

          <ul className="history-list">
            {items.map(
              ({
                analysis,
                resume,
              }) => {
                const score =
                  getAnalysisScore(analysis)

                return (
                  <li
                    key={analysis.id}
                    className="history-row"
                    tabIndex={0}
                    aria-label={`เปิดผลวิเคราะห์ ${resume.originalName}`}
                    onClick={() =>
                      navigate(
                        `/analyses/${analysis.id}`,
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key === "Enter" ||
                        event.key === " "
                      ) {
                        event.preventDefault()

                        navigate(
                          `/analyses/${analysis.id}`,
                        )
                      }
                    }}
                  >
                    <div className="history-row__main">
                      <span className="history-row__icon">
                        <FileSearch size={18} />
                      </span>

                      <div className="history-row__text">
                        <strong>
                          {resume.originalName}
                        </strong>

                        <span className="history-row__meta">
                          <span
                            className={`history-type history-type--${analysis.analysisType.toLowerCase()}`}
                          >
                            {getAnalysisTypeLabel(
                              analysis.analysisType,
                            )}
                          </span>

                          {analysis.job && (
                            <span className="history-row__job">
                              {analysis.job.title}
                              {analysis.job.company
                                ? ` · ${analysis.job.company}`
                                : ""}
                            </span>
                          )}
                        </span>
                      </div>
                    </div>

                    <StatusBadge status={analysis.status} />

                    <div className="history-score-cell">
                      <strong className="history-score">
                        {score ?? "—"}
                        {score !== null && (
                          <small>/100</small>
                        )}
                      </strong>

                      {score !== null && (
                        <span
                          className={`history-score__bar history-score__bar--${getScoreTone(score)}`}
                          style={{ "--score": score } as CSSProperties}
                          aria-hidden="true"
                        />
                      )}
                    </div>

                    <span className="history-row__date">
                      {formatThaiDate(
                        analysis.createdAt,
                      )}
                      <small>
                        {formatThaiTime(
                          analysis.createdAt,
                        )}
                      </small>
                    </span>

                    <div className="history-actions">
                        <button
                          type="button"
                          className="history-delete-button"
                          aria-label={`ลบผลวิเคราะห์ ${resume.originalName}`}
                          title="ลบผลวิเคราะห์"
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
                          className="history-row__chevron"
                          size={19}
                          aria-hidden="true"
                        />
                    </div>
                  </li>
                )
              },
            )}
          </ul>
        </section>
            )}

      {analysisToDelete && (
        <ModalDialog
          labelledBy="delete-analysis-title"
          dismissible={!isDeleting}
          onClose={() => {
            setAnalysisToDelete(null)
            setDeleteError("")
          }}
        >
          <div className="history-modal">
            <div className="history-modal__icon">
              <Trash2 size={22} />
            </div>

            <h2 id="delete-analysis-title">
              ลบประวัติการวิเคราะห์?
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
                  ตำแหน่งงาน:{" "}
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
              ผลการวิเคราะห์นี้ได้
            </p>

            {isLastAnalysisOfResume && (
              <p className="history-modal__warning">
                นี่คือผลการวิเคราะห์สุดท้ายของ Resume นี้
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
                ยกเลิก
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
                  : "ลบ"}
              </button>
            </div>
          </div>
        </ModalDialog>
      )}
    </main>
  )
}