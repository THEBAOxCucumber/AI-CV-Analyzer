import type {
  Request,
  Response,
} from "express";

import { AppError } from "../../errors/app-error.js";
import {
  asyncHandler,
} from "../../shared/async-handler.js";
import {
  analyzeResume,
  getResumeAnalysis,
} from "./resume-analysis.service.js";
import type {
  AnalyzeResumeBody,
} from "./resume-analysis.validation.js";

function getAuthenticatedUserId(
  req: Request,
): number {
  if (!req.user) {
    throw new AppError(
      "กรุณาเข้าสู่ระบบ",
      401,
      "UNAUTHENTICATED",
    );
  }

  return req.user.id;
}

function parseResumeId(
  req: Request,
): number {
  const resumeId = Number(
    req.params.resumeId,
  );

  if (
    !Number.isInteger(resumeId) ||
    resumeId <= 0
  ) {
    throw new AppError(
      "resumeId ไม่ถูกต้อง",
      400,
      "INVALID_RESUME_ID",
    );
  }

  return resumeId;
}

export const analyzeResumeController =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ): Promise<void> => {
      const userId =
        getAuthenticatedUserId(req);

      const resumeId =
        parseResumeId(req);

      const body =
        req.body as AnalyzeResumeBody;

      const analysis =
        await analyzeResume({
          resumeId,
          userId,
          force: body.force,
        });

      res.status(200).json({
        success: true,
        message:
          "วิเคราะห์ Resume สำเร็จ",
        data: analysis,
      });
    },
  );

export const getResumeAnalysisController =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ): Promise<void> => {
      const userId =
        getAuthenticatedUserId(req);

      const resumeId =
        parseResumeId(req);

      const analysis =
        await getResumeAnalysis(
          resumeId,
          userId,
        );

      res.status(200).json({
        success: true,
        message:
          "ดึงผลวิเคราะห์ Resume สำเร็จ",
        data: analysis,
      });
    },
  );

  