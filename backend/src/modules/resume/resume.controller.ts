import type {
  Request,
  Response,
} from "express";


import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  getUserResumes,
  saveUploadedResume,
} from "./resume.service.js";
import {
  chunkResumeText,
  getResumeChunks,
} from "./resume-chunk.service.js";
//import type { ResumeIdParams } from "./resume.validation.js";

export const uploadResumeController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    if (!req.file) {
      throw new AppError(
        "กรุณาเลือกไฟล์ Resume",
        400,
        "RESUME_FILE_REQUIRED",
      );
    }

    const resume = await saveUploadedResume(
      req.user.id,
      req.file,
    );

    res.status(201).json({
      success: true,
      message: "อัปโหลด Resume สำเร็จ",
      data: {
        resume,
      },
    });
  },
);

export const getMyResumesController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    const resumes = await getUserResumes(
      req.user.id,
    );

    res.status(200).json({
      success: true,
      message: "ดึงรายการ Resume สำเร็จ",
      data: {
        resumes,
      },
    });
  },
  
);

export const createResumeChunksController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    const resumeId = Number(req.params.resumeId);

    if (!Number.isInteger(resumeId) || resumeId <= 0) {
      throw new AppError(
        "resumeId ไม่ถูกต้อง",
        400,
        "INVALID_RESUME_ID",
      );
    }

    const chunks = await chunkResumeText(
      resumeId,
      req.user.id,
    );

    res.status(201).json({
      success: true,
      message: "แบ่งข้อความ Resume สำเร็จ",
      data: {
        chunkCount: chunks.length,
        chunks,
      },
    });
  },
);

export const getResumeChunksController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    const resumeId = Number(req.params.resumeId);

    if (!Number.isInteger(resumeId) || resumeId <= 0) {
      throw new AppError(
        "resumeId ไม่ถูกต้อง",
        400,
        "INVALID_RESUME_ID",
      );
    }

    const chunks = await getResumeChunks(
      resumeId,
      req.user.id,
    );

    res.status(200).json({
      success: true,
      message: "ดึง Resume Chunks สำเร็จ",
      data: {
        chunkCount: chunks.length,
        chunks,
      },
    });
  },
);