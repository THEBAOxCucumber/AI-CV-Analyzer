import type { Request, Response } from "express";

import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  getCurrentUser,
  login,
  register,
} from "./auth.service.js";
import type {
  LoginBody,
  RegisterBody,
} from "./auth.validation.js";

export const registerController = asyncHandler(
  async (
    req: Request<object, object, RegisterBody>,
    res: Response,
  ) => {
    const result = await register(req.body);

    res.status(201).json({
      success: true,
      message: "สมัครสมาชิกสำเร็จ",
      data: result,
    });
  },
);

export const loginController = asyncHandler(
  async (
    req: Request<object, object, LoginBody>,
    res: Response,
  ) => {
    const result = await login(req.body);

    res.status(200).json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      data: result,
    });
  },
);

export const getMeController = asyncHandler(
  async (req: Request, res: Response) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    const user = await getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      message: "ดึงข้อมูลผู้ใช้สำเร็จ",
      data: {
        user,
      },
    });
  },
);