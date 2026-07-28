import fs from "node:fs";
import path from "node:path";
import crypto from "node:crypto";

import multer from "multer";

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

  const isPdfMimeType =
    file.mimetype === "application/pdf";

  const isPdfExtension = extension === ".pdf";

  if (!isPdfMimeType || !isPdfExtension) {
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