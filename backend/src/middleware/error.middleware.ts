import type {
  ErrorRequestHandler,
  NextFunction,
  Request,
} from "express";
import multer from "multer";
import { ZodError } from "zod";

import { AppError } from "../errors/app-error.js";

interface MySqlError extends Error {
  code?: string;
  errno?: number;
  sqlMessage?: string;
}

export const notFoundHandler = (
  req: Request,
  _res: unknown,
  next: NextFunction,
): void => {
  next(
    new AppError(
      `ไม่พบ API ${req.method} ${req.originalUrl}`,
      404,
      "ENDPOINT_NOT_FOUND",
    ),
  );
};

export const errorHandler: ErrorRequestHandler = (
  error: unknown,
  _req,
  res,
  _next,
) => {
  console.error("Application error:", error);

  if (error instanceof multer.MulterError) {
    if (error.code === "LIMIT_FILE_SIZE") {
      res.status(413).json({
        success: false,
        message:
          "ไฟล์ Resume มีขนาดใหญ่เกินกำหนด",
        code: "RESUME_FILE_TOO_LARGE",
      });
      return;
    }

    if (error.code === "LIMIT_FILE_COUNT") {
      res.status(400).json({
        success: false,
        message:
          "อัปโหลดไฟล์ได้ครั้งละ 1 ไฟล์เท่านั้น",
        code: "TOO_MANY_FILES",
      });
      return;
    }

    if (error.code === "LIMIT_UNEXPECTED_FILE") {
      res.status(400).json({
        success: false,
        message:
          "ชื่อช่องไฟล์ไม่ถูกต้อง กรุณาใช้ชื่อ resume",
        code: "UNEXPECTED_FILE_FIELD",
      });
      return;
    }

    res.status(400).json({
      success: false,
      message: "ไม่สามารถอัปโหลดไฟล์ได้",
      code: error.code,
    });
    return;
  }

  if (error instanceof ZodError) {
    res.status(400).json({
      success: false,
      message: "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      code: "VALIDATION_ERROR",
      errors: error.flatten(),
    });
    return;
  }

  if (error instanceof AppError) {
  res.status(error.statusCode).json({
    success: false,
    message: error.message,
    code: error.code,
    ...(error.details !== undefined && {
      errors: error.details,
    }),
  });

  return;
}

  const mysqlError = error as MySqlError;

  if (mysqlError.code === "ER_DUP_ENTRY") {
    res.status(409).json({
      success: false,
      message: "ข้อมูลนี้มีอยู่ในระบบแล้ว",
      code: "DUPLICATE_ENTRY",
    });
    return;
  }

  if (
    mysqlError.code ===
    "ER_NO_REFERENCED_ROW_2"
  ) {
    res.status(400).json({
      success: false,
      message: "ข้อมูลอ้างอิงไม่ถูกต้อง",
      code: "INVALID_REFERENCE",
    });
    return;
  }

  res.status(500).json({
    success: false,
    message: "เกิดข้อผิดพลาดภายในเซิร์ฟเวอร์",
    code: "INTERNAL_SERVER_ERROR",
  });
};