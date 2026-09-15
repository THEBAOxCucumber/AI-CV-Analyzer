import fs from "node:fs";
import fsPromises from "node:fs/promises";
import path from "node:path";
import crypto from "node:crypto";

import multer from "multer";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";

const uploadDirectory = path.resolve(
  process.cwd(),
  env.upload.resumeDirectory,
);

/*
 * สร้างโฟลเดอร์ให้อัตโนมัติ หากยังไม่มี
 */
fs.mkdirSync(uploadDirectory, {
  recursive: true,
});

const storage = multer.diskStorage({
  destination: (_req, _file, callback) => {
    callback(null, uploadDirectory);
  },

  filename: (_req, file, callback) => {
    /*
     * สร้างชื่อใหม่ ไม่ใช้ชื่อเดิมโดยตรง
     * ช่วยลดปัญหาชื่อซ้ำและอักขระแปลก ๆ
     */
    const uniqueName = crypto.randomUUID();
    const extension = path
      .extname(file.originalname)
      .toLowerCase();

    callback(null, `${uniqueName}${extension}`);
  },
});

const fileFilter: multer.Options["fileFilter"] = (
  _req,
  file,
  callback,
) => {
  const extension = path
    .extname(file.originalname)
    .toLowerCase();

  const allowedMimeTypes = [
    "application/pdf",
    "application/x-pdf",
    "application/octet-stream",
  ];

  const isPdfExtension = extension === ".pdf";
  const isAllowedMimeType = allowedMimeTypes.includes(
    file.mimetype.toLowerCase(),
  );

  if (!isPdfExtension || !isAllowedMimeType) {
    callback(
      new AppError(
        "อนุญาตให้อัปโหลดเฉพาะไฟล์ PDF เท่านั้น",
        400,
        "INVALID_RESUME_FILE_TYPE",
      ),
    );
    return;
  }

  callback(null, true);
};

const maxFileSize =
  env.upload.maxResumeSizeMb * 1024 * 1024; //5 MB

export const resumeUpload = multer({
  storage,
  fileFilter,
  limits: {
    fileSize: maxFileSize,
    files: 1,
    fields: 5,
  },

});

export async function verifyUploadedResumePdf(
  req: Request,
  _res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.file) {
    next();
    return;
  }

  try {
    const fileHandle =
      await fsPromises.open(
        req.file.path,
        "r",
      );

    let isPdf = false;

    try {
      const signature =
        Buffer.alloc(5);

      await fileHandle.read(
        signature,
        0,
        5,
        0,
      );

      isPdf =
        signature.toString("ascii") ===
        "%PDF-";
    } finally {
      await fileHandle.close();
    }

    if (!isPdf) {
      await fsPromises
        .unlink(req.file.path)
        .catch(() => undefined);

      next(
        new AppError(
          "ไฟล์ที่อัปโหลดไม่ใช่ PDF ที่ถูกต้อง",
          400,
          "INVALID_RESUME_FILE_CONTENT",
        ),
      );
      return;
    }

    next();
  } catch (error) {
    await fsPromises
      .unlink(req.file.path)
      .catch(() => undefined);

    next(error);
  }
}