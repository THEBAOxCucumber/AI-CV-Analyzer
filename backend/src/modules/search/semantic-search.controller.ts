import type {
  Request,
  Response,
} from "express";

import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  answerResumeQuestion,
} from "./resume-question.service.js";
import {
  semanticSearchResume,
} from "./semantic-search.service.js";

function getResumeId(req: Request): number {
  const resumeId = Number(req.params.resumeId);

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

export const searchResumeController =
  asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.user) {
        throw new AppError(
          "กรุณาเข้าสู่ระบบ",
          401,
          "UNAUTHENTICATED",
        );
      }

      const resumeId = getResumeId(req);

      const body = req.body as {
        query: string;
        limit?: number;
        scoreThreshold?: number;
      };

      const results =
        await semanticSearchResume({
          userId: req.user.id,
          resumeId,
          query: body.query,
          limit: body.limit,
          scoreThreshold:
            body.scoreThreshold,
        });

      res.status(200).json({
        success: true,
        message: "ค้นหา Resume สำเร็จ",
        data: {
          query: body.query,
          resultCount: results.length,
          results,
        },
      });
    },
  );

export const askResumeController =
  asyncHandler(
    async (req: Request, res: Response) => {
      if (!req.user) {
        throw new AppError(
          "กรุณาเข้าสู่ระบบ",
          401,
          "UNAUTHENTICATED",
        );
      }

      const resumeId = getResumeId(req);

      const body = req.body as {
        question: string;
        limit?: number;
      };

      const result =
        await answerResumeQuestion({
          userId: req.user.id,
          resumeId,
          question: body.question,
          limit: body.limit,
        });

      res.status(200).json({
        success: true,
        message: "วิเคราะห์ Resume สำเร็จ",
        data: result,
      });
    },
  );