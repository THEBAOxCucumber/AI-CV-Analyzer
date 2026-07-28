import fs from "node:fs/promises";

import { AppError } from "../../errors/app-error.js";
import {
  extractTextFromPdf,
  validatePdfSignature,
} from "../../utils/pdf.util.js";
import {
  createResumeRecord,
  findResumeById,
  findResumesByUserId,
  markResumeExtractionFailed,
  updateResumeExtraction,
} from "./resume.repository.js";
import type {
  ExtractionStatus,
  Resume,
  ResumeRow,
} from "./resume.types.js";

import { chunkResumeText } from "./resume-chunk.service.js";

function mapResume(row: ResumeRow): Resume {
  return {
    id: row.id,
    userId: row.user_id,
    originalName: row.original_name,
    storedName: row.stored_name,
    filePath: row.file_path,
    mimeType: row.mime_type,
    fileSize: row.file_size,

    extractedText: row.extracted_text,
    pageCount: row.page_count,
    characterCount: row.character_count,
    extractionStatus: row.extraction_status,
    extractionError: row.extraction_error,

    status: row.status,
    createdAt: row.created_at,
    updatedAt: row.updated_at,

    chunkingStatus: row.chunking_status,
    chunkCount: row.chunk_count,
    chunkingError: row.chunking_error,
  };
}

export async function saveUploadedResume(
  userId: number,
  file: Express.Multer.File,
): Promise<Resume> {
  let resumeId: number | null = null;

  try {
    /*
     * ขั้นที่ 1 ตรวจเนื้อหาไฟล์ว่าเป็น PDF จริง
     */
    await validatePdfSignature(file.path);

    /*
     * ขั้นที่ 2 สร้าง Record ในฐานข้อมูล
     */
    resumeId = await createResumeRecord({
      userId,
      originalName: file.originalname,
      storedName: file.filename,
      filePath: file.path,
      mimeType: file.mimetype,
      fileSize: file.size,
    });

    /*
     * ขั้นที่ 3 ดึงข้อความจาก PDF
     */
    const extraction = await extractTextFromPdf(
      file.path,
    );

    /*
     * PDF ที่เป็นภาพสแกนอาจไม่มี Text Layer
     */
    const extractionStatus: ExtractionStatus =
      extraction.text.length > 0
        ? "COMPLETED"
        : "EMPTY";

    /*
     * ขั้นที่ 4 อัปเดตข้อความลงฐานข้อมูล
     */
    const updated = await updateResumeExtraction(
      resumeId,
      userId,
      extraction.text,
      extraction.pageCount,
      extraction.characterCount,
      extractionStatus,
    );

    if (!updated) {
      throw new AppError(
        "ไม่สามารถบันทึกข้อความจาก Resume ได้",
        500,
        "RESUME_EXTRACTION_UPDATE_FAILED",
      );
    }

    /*
     * ขั้นที่ 5 ดึงข้อมูลล่าสุดกลับมา
     */
    const resume = await findResumeById(
  resumeId,
  userId,
);

if (!resume) {
  throw new AppError(
    "ไม่พบข้อมูล Resume หลังจากประมวลผล",
    500,
    "RESUME_RECORD_NOT_FOUND",
  );
}

if (extractionStatus === "COMPLETED") {
  await chunkResumeText(
    resumeId,
    userId,
  );
}

const processedResume = await findResumeById(
  resumeId,
  userId,
);

if (!processedResume) {
  throw new AppError(
    "ไม่พบข้อมูล Resume หลังจากแบ่ง Chunk",
    500,
    "RESUME_RECORD_NOT_FOUND",
  );
}

return mapResume(processedResume);
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถประมวลผล Resume ได้";

    /*
     * มี Record ในฐานข้อมูลแล้ว:
     * เก็บสถานะ FAILED ไว้สำหรับตรวจสอบย้อนหลัง
     */
    if (resumeId !== null) {
      await markResumeExtractionFailed(
        resumeId,
        userId,
        message,
      ).catch((databaseError) => {
        console.error(
          "Unable to mark extraction as failed:",
          databaseError,
        );
      });
    } else {
      /*
       * ยังไม่มี Record:
       * ลบไฟล์ที่ไม่ผ่าน Signature
       */
      await fs.unlink(file.path).catch(() => undefined);
    }

    throw error;
  }
}

export async function getUserResumes(
  userId: number,
): Promise<Resume[]> {
  const rows = await findResumesByUserId(userId);

  return rows.map((row) => {
    const resume = mapResume(row);

    delete resume.extractedText;
    delete resume.extractionError;

    return resume;
  });
}