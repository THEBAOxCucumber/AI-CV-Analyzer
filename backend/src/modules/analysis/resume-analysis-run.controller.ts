import type {
  Request,
  Response,
} from "express";

import { AppError } from "../../errors/app-error.js";
import {
  asyncHandler,
} from "../../shared/async-handler.js";

import {
  getAnalysisRun,
  getResumeAnalysisHistory,
  startAnalysisRun,
} from "./resume-analysis-run.service.js";

function requireUserId(
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

function parsePositiveInteger(
  value: unknown,
  fieldName: string,
): number {
  const parsed = Number(value);

  if (
    !Number.isInteger(parsed) ||
    parsed <= 0
  ) {
    throw new AppError(
      `${fieldName} ไม่ถูกต้อง`,
      400,
      `INVALID_${fieldName.toUpperCase()}`,
    );
  }

  return parsed;
}

export const createResumeAnalysisRunController =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      const userId =
        requireUserId(req);

      const resumeId =
        parsePositiveInteger(
          req.params.resumeId,
          "resumeId",
        );

      const {
        analysisType,
        jobDescriptionId,
      } = req.body as {
        analysisType:
        | "BASE"
        | "JOB_MATCH"
        | "COMBINED";
        jobDescriptionId?: number;
      };

      const analysisRun =
        await startAnalysisRun({
          resumeId,
          userId,
          analysisType,
          jobDescriptionId,
        });

      res.status(202).json({
        success: true,
        message:
          "สร้างงานวิเคราะห์ Resume สำเร็จ",
        data: {
          analysisRun,
        },
      });
    },
  );

export const getResumeAnalysisHistoryController =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      const userId =
        requireUserId(req);

      const resumeId =
        parsePositiveInteger(
          req.params.resumeId,
          "resumeId",
        );

      const parsedLimit =
        Number(req.query.limit);

      const limit =
        req.query.limit === undefined ||
          Number.isNaN(parsedLimit)
          ? 20
          : Math.min(
            100,
            Math.max(
              1,
              parsedLimit,
            ),
          );
      const analyses =
        await getResumeAnalysisHistory(
          resumeId,
          userId,
          limit,
        );

      res.status(200).json({
        success: true,
        message:
          "ดึงประวัติการวิเคราะห์สำเร็จ",
        data: {
          analyses,
        },
      });
    },
  );

export const getAnalysisRunController =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      const userId =
        requireUserId(req);

      const analysisRunId =
        parsePositiveInteger(
          req.params.analysisRunId,
          "analysisRunId",
        );

      const analysisRun =
        await getAnalysisRun(
          analysisRunId,
          userId,
        );

      res.status(200).json({
        success: true,
        message:
          "ดึงผลการวิเคราะห์สำเร็จ",
        data: {
          analysisRun,
        },
      });
    },
  );