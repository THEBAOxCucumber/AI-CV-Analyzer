import {
  Check,
  CheckCircle2,
  CircleAlert,
  FileText,
  Lightbulb,
  LoaderCircle,
  UploadCloud,
  X,
} from "lucide-react"

import {
  useRef,
  useState,
  type ChangeEvent,
  type DragEvent,
} from "react"

import {
  ApiError,
} from "../services/api"

import {
  uploadResume,
} from "../services/resume.service"

import type {
  Resume,
} from "../types/resume"


import {
  useNavigate,
} from "react-router-dom"

import {
  startBaseAnalysis,
} from "../services/analysis.service"

import {
  embedResume,
} from "../services/embedding.service"

import "../styles/pages/UploadResumePage.css"


/*
 * ต้องตรงกับ MAX_RESUME_SIZE_MB ของ backend (5 MB)
 */
const MAX_FILE_SIZE_MB = 5

const MAX_FILE_SIZE =
  MAX_FILE_SIZE_MB * 1024 * 1024

function formatFileSize(
  bytes: number,
): string {
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

export function UploadResumePage() {
  const inputRef =
    useRef<HTMLInputElement>(null)

  const [file, setFile] =
    useState<File | null>(null)

  const [uploadedResume, setUploadedResume] =
    useState<Resume | null>(null)

  const [error, setError] =
    useState("")

  const [isDragging, setIsDragging] =
    useState(false)

  const [isUploading, setIsUploading] =
    useState(false)

  const navigate = useNavigate()

  const [isStartingAnalysis, setIsStartingAnalysis] =
    useState(false)

  function validateFile(
    selectedFile: File,
  ): boolean {
    setError("")
    setUploadedResume(null)

    const isPdf =
      selectedFile.type ===
      "application/pdf" ||
      selectedFile.name
        .toLowerCase()
        .endsWith(".pdf")

    if (!isPdf) {
      setError(
        "รองรับเฉพาะไฟล์ PDF เท่านั้น",
      )


      return false
    }

    if (
      selectedFile.size >
      MAX_FILE_SIZE
    ) {
      setError(
        `ไฟล์มีขนาดใหญ่เกิน ${MAX_FILE_SIZE_MB} MB`,
      )

      return false
    }
    return true
  }

  function selectFile(
    selectedFile: File,
  ) {
    if (
      !validateFile(selectedFile)
    ) {
      setFile(null)
      return
    }

    setFile(selectedFile)
  }

  function handleChange(
    event:
      ChangeEvent<HTMLInputElement>,
  ) {
    const selectedFile =
      event.target.files?.[0]

    if (selectedFile) {
      selectFile(selectedFile)
    }

    event.target.value = ""
  }

  function handleDrop(
    event: DragEvent<HTMLDivElement>,
  ) {
    event.preventDefault()
    setIsDragging(false)

    const selectedFile =
      event.dataTransfer.files[0]

    if (selectedFile) {
      selectFile(selectedFile)
    }
  }

  async function handleUpload() {
    if (!file || isUploading) {
      return
    }

    setError("")
    setIsUploading(true)

    try {
      const response =
        await uploadResume(file)

      setUploadedResume(
        response.data.resume,
      )

      setFile(null)
    } catch (uploadError) {
      if (
        uploadError instanceof ApiError
      ) {
        setError(
          uploadError.message,
        )
      } else {
        setError(
          "ไม่สามารถอัปโหลด Resume ได้",
        )
      }
    } finally {
      setIsUploading(false)
    }
  }

  function removeFile() {
    if (isUploading) {
      return
    }

    setFile(null)
    setError("")
  }
  async function handleAnalyze() {
    if (
      !uploadedResume ||
      isStartingAnalysis
    ) {
      return
    }

    setError("")
    setIsStartingAnalysis(true)

    try {
      await embedResume(
        uploadedResume.id,
      )

      const response =
        await startBaseAnalysis(
          uploadedResume.id,
        )

      navigate(
        `/analyses/${response.data.analysisRun.id}`,
      )
    } catch (analysisError) {
      if (
        analysisError instanceof ApiError
      ) {
        setError(
          analysisError.message,
        )
      } else {
        setError(
          "ไม่สามารถเตรียมและวิเคราะห์ Resume ได้",
        )
      }

      setIsStartingAnalysis(false)
    }
  }


  return (
    <main className="upload-page">
      <header className="upload-page__header">
        <p className="upload-page__eyebrow">
          Resume
        </p>

        <h1>
          อัปโหลด Resume
        </h1>

        <p>
          อัปโหลด Resume ของคุณ
          เพื่อเตรียมสำหรับการวิเคราะห์ด้วย AI
        </p>
      </header>

      <div className="upload-layout">
      <section className="upload-card">
        {!uploadedResume && (
          <>
            <div
              className={[
                "upload-dropzone",
                isDragging
                  ? "upload-dropzone--dragging"
                  : "",
              ]
                .filter(Boolean)
                .join(" ")}
              onDragEnter={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragOver={(event) => {
                event.preventDefault()
                setIsDragging(true)
              }}
              onDragLeave={() =>
                setIsDragging(false)
              }
              onDrop={handleDrop}
            >
              <input
                ref={inputRef}
                type="file"
                accept="application/pdf,.pdf"
                hidden
                onChange={handleChange}
              />

              <div className="upload-dropzone__icon">
                <UploadCloud size={30} />
              </div>

              <h2>
                {isDragging
                  ? "ปล่อยไฟล์ที่นี่"
                  : "อัปโหลด Resume"}
              </h2>

              <p>
                {isDragging
                  ? "วางไฟล์ PDF เพื่อเลือก"
                  : "ลากไฟล์มาวางที่นี่ หรือคลิกเพื่อเลือกไฟล์"}
              </p>

              {/*
                * ปุ่มจริง (คีย์บอร์ด/screen reader)
                * ::after ขยายพื้นที่คลิกให้คลุมทั้งกรอบ
                */}
              <button
                type="button"
                className="upload-dropzone__pick"
                onClick={() =>
                  inputRef.current?.click()
                }
              >
                เลือกไฟล์
              </button>

              <span className="upload-dropzone__hint">
                PDF · ไม่เกิน {MAX_FILE_SIZE_MB} MB
              </span>
            </div>

            {file && (
              <div
                className={
                  isUploading
                    ? "selected-file selected-file--uploading"
                    : "selected-file"
                }
              >
                <div className="selected-file__icon">
                  <FileText size={23} />
                  <span className="selected-file__badge">PDF</span>
                </div>

                <div className="selected-file__details">
                  <strong>
                    {file.name}
                  </strong>

                  <span>
                    {isUploading
                      ? "กำลังอัปโหลดและแบ่งเนื้อหา…"
                      : formatFileSize(file.size)}
                  </span>

                  {isUploading && (
                    <span
                      className="selected-file__progress"
                      role="progressbar"
                      aria-label="กำลังอัปโหลด"
                    />
                  )}
                </div>

                <button
                  type="button"
                  aria-label="นำไฟล์ออก"
                  onClick={removeFile}
                  disabled={isUploading}
                >
                  <X size={19} />
                </button>
              </div>
            )}

            {error && (
              <div
                className="upload-error"
                role="alert"
              >
                <CircleAlert size={18} aria-hidden="true" />
                {error}
              </div>
            )}

            <button
              type="button"
              className="upload-submit"
              disabled={
                !file || isUploading
              }
              onClick={handleUpload}
            >
              {isUploading && (
                <LoaderCircle
                  className="upload-submit__spinner"
                  size={18}
                  aria-hidden="true"
                />
              )}
              {isUploading
                ? "กำลังอัปโหลด..."
                : "อัปโหลด Resume"}
            </button>
          </>
        )}

        {uploadedResume && (
          <div className="upload-success">
            <div className="upload-success__icon">
              <CheckCircle2 size={34} />
            </div>

            <h2>
              อัปโหลดสำเร็จ
            </h2>

            <p>
              Resume พร้อมสำหรับ
              การวิเคราะห์ด้วย AI
            </p>

            <div className="upload-success__resume">
              <FileText size={22} />

              <div>
                <strong>
                  {
                    uploadedResume.originalName
                  }
                </strong>

                <span>
                  {uploadedResume.pageCount ??
                    "—"}{" "}
                  หน้า
                  {" • "}
                  {
                    uploadedResume.chunkCount
                  }{" "}
                  ส่วน
                </span>
              </div>
            </div>

            <button
              type="button"
              className="upload-submit"
              disabled={isStartingAnalysis}
              onClick={handleAnalyze}
            >
              {isStartingAnalysis && (
                <LoaderCircle
                  className="upload-submit__spinner"
                  size={18}
                  aria-hidden="true"
                />
              )}
              {isStartingAnalysis
                ? "กำลังเตรียม Resume..."
                : "วิเคราะห์ Resume"}
            </button>
          </div>
        )}
      </section>

      <aside className="upload-guide">
        <section className="upload-guide__card">
          <h2>ขั้นตอน</h2>

          <ol className="upload-steps">
            {[
              {
                title: "อัปโหลด Resume",
                detail: `ไฟล์ PDF ไม่เกิน ${MAX_FILE_SIZE_MB} MB`,
              },
              {
                title: "AI วิเคราะห์",
                detail: "ใช้เวลาประมาณ 1–2 นาที",
              },
              {
                title: "ดูคะแนนและคำแนะนำ",
                detail: "คะแนนรายหมวด จุดแข็ง และสิ่งที่ควรปรับ",
              },
            ].map((step, index) => {
              // อัปโหลดแล้ว → ขั้นที่ 2
              const currentStep = uploadedResume ? 2 : 1
              const stepNumber = index + 1
              const state =
                stepNumber < currentStep
                  ? "done"
                  : stepNumber === currentStep
                    ? "active"
                    : "upcoming"

              return (
                <li
                  key={step.title}
                  data-state={state}
                  aria-current={state === "active" ? "step" : undefined}
                >
                  <span aria-hidden="true">
                    {state === "done"
                      ? <Check size={16} strokeWidth={3} />
                      : stepNumber}
                  </span>
                  <div>
                    <strong>{step.title}</strong>
                    <p>{step.detail}</p>
                  </div>
                </li>
              )
            })}
          </ol>
        </section>

        <section className="upload-guide__card upload-guide__card--tips">
          <h2>
            <Lightbulb size={18} />
            เคล็ดลับก่อนอัปโหลด
          </h2>

          <ul className="upload-tips">
            <li>
              <CheckCircle2 size={16} />
              ใช้ PDF ที่เป็นข้อความ ไม่ใช่ภาพสแกน
              เพื่อให้ AI อ่านได้ครบ
            </li>

            <li>
              <CheckCircle2 size={16} />
              แบ่งหัวข้อชัดเจน: ข้อมูลติดต่อ สรุปโปรไฟล์
              ทักษะ ประสบการณ์ โปรเจกต์ การศึกษา
            </li>

            <li>
              <CheckCircle2 size={16} />
              ระบุผลงานเป็นตัวเลข เช่น
              ลดเวลาทำงานลง 30%
            </li>
          </ul>
        </section>
      </aside>
      </div>
    </main>
  )
}