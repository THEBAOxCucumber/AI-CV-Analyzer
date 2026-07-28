import type { Request, Response } from "express";
import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  getProfile,
  saveProfile,
} from "./profile.service.js";

import type { UpdateProfileBody } from "./profile.validation.js";
//import type { UpdateProfileInput } from "./profile.types.js";

export const getProfileController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    const profile = await getProfile(req.user.id);

    res.status(200).json({
      success: true,
      message: "ดึงข้อมูลโปรไฟล์สำเร็จ",
      data: {
        profile,
      },
    });
  },
);

export const updateProfileController = asyncHandler(
  async (
    req: Request<object, object, UpdateProfileBody>,
    res: Response,
  ) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    const profile = await saveProfile(
      req.user.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "บันทึกข้อมูลโปรไฟล์สำเร็จ",
      data: {
        profile,
      },
    });
  },
);