import type {
  Request,
  Response,
} from "express";
import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import { createJobDescriptionForUser } from "./job-description.service.js";

export const createJobDescriptionController =
  asyncHandler(
    async (
      req: Request,
      res: Response,
    ) => {
      if (!req.user) {
        throw new AppError(
          "กรุณาเข้าสู่ระบบ",
          401,
          "UNAUTHENTICATED",
        );
      }

      const {
        title,
        company,
        description,
      } = req.body as {
        title?: string;
        company?: string;
        description: string;
      };

      const jobDescription =
        await createJobDescriptionForUser({
          userId: req.user.id,
          title,
          company,
          description,
        });

      res.status(201).json({
        success: true,
        message:
          "สร้าง Job Description สำเร็จ",
        data: {
          jobDescription,
        },
      });
    },
  );