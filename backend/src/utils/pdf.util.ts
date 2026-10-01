import fs from "node:fs/promises";

import { fileTypeFromFile } from "file-type";
import { PDFParse } from "pdf-parse";

import { AppError } from "../errors/app-error.js";
import type { PdfExtractionResult } from "../modules/resume/resume.types.js";
import { normalizeExtractedText } from "./text-normalize.util.js";

/**
 * ตรวจสอบชนิดไฟล์จาก binary signature หรือ magic number
 */
export async function validatePdfSignature(
  filePath: string,
): Promise<void> {
  const detectedType = await fileTypeFromFile(filePath);

  if (
    !detectedType ||
    detectedType.ext !== "pdf" ||
    detectedType.mime !== "application/pdf"
  ) {
    throw new AppError(
      "ไฟล์ที่อัปโหลดไม่ใช่ PDF ที่ถูกต้อง",
      400,
      "INVALID_PDF_SIGNATURE",
    );
  }
}

/**
 * ดึงข้อความและจำนวนหน้าจาก PDF
 */
export async function extractTextFromPdf(
  filePath: string,
): Promise<PdfExtractionResult> {
  const fileBuffer = await fs.readFile(filePath);

  const parser = new PDFParse({
    data: fileBuffer,
  });

  try {
    const result = await parser.getText();

    const normalizedText = normalizeExtractedText(
      result.text ?? "",
    );

    return {
      text: normalizedText,
      pageCount: result.total ?? 0,
      characterCount: normalizedText.length,
    };
  } catch (error) {
    console.error("PDF extraction error:", error);

    throw new AppError(
      "ไม่สามารถอ่านข้อความจากไฟล์ PDF ได้",
      422,
      "PDF_TEXT_EXTRACTION_FAILED",
    );
  } finally {
    await parser.destroy();
  }
}