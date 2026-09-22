import {
  CheckCircle2,
  FileText,
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


const MAX_FILE_SIZE =
  10 * 1024 * 1024

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
        "ไฟล์มีขนาดใหญ่เกิน 10 MB",
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
          Upload Resume
        </h1>

        <p>
          อัปโหลด Resume ของคุณ
          เพื่อเตรียมสำหรับการวิเคราะห์ด้วย AI
        </p>
      </header>

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
              role="button"
              tabIndex={0}
              onClick={() =>
                inputRef.current?.click()
              }
              onKeyDown={(event) => {
                if (
                  event.key === "Enter" ||
                  event.key === " "
                ) {
                  inputRef.current?.click()
                }
              }}
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
                อัปโหลด Resume
              </h2>

              <p>
                ลากไฟล์มาวางที่นี่
                หรือคลิกเพื่อเลือกไฟล์
              </p>

              <span>
                PDF เท่านั้น
              </span>
            </div>

            {file && (
              <div className="selected-file">
                <div className="selected-file__icon">
                  <FileText size={23} />
                </div>

                <div className="selected-file__details">
                  <strong>
                    {file.name}
                  </strong>

                  <span>
                    {formatFileSize(
                      file.size,
                    )}
                  </span>
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
              {isUploading
                ? "กำลังอัปโหลดและประมวลผล..."
                : "Upload Resume"}
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
              AI Analysis
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
                  chunks
                </span>
              </div>
            </div>

            <button
              type="button"
              className="upload-submit"
              disabled={isStartingAnalysis}
              onClick={handleAnalyze}
            >
              {isStartingAnalysis
                ? "Preparing Resume..."
                : "Analyze Resume"}
            </button>
          </div>
        )}
      </section>
    </main>
  )
}