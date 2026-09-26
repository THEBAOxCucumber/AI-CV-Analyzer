import type { Request, Response } from "express";

import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  changePassword,
  getCurrentUser,
  login,
  register,
} from "./auth.service.js";
import type {
  ChangePasswordBody,
  ForgotPasswordBody,
  LoginBody,
  RegisterBody,
  ResetPasswordBody,
} from "./auth.validation.js";
import {
  requestPasswordReset,
  resetPasswordWithOtp,
} from "../password-reset/password-reset.service.js";

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

export const changePasswordController = asyncHandler(
  async (
    req: Request<object, object, ChangePasswordBody>,
    res: Response,
  ) => {
    if (!req.user) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "UNAUTHENTICATED",
      );
    }

    await changePassword(
      req.user.id,
      req.body,
    );

    res.status(200).json({
      success: true,
      message: "เปลี่ยนรหัสผ่านสำเร็จ",
    });
  },
);

export const forgotPasswordController = asyncHandler(
  async (
    req: Request<object, object, ForgotPasswordBody>,
    res: Response,
  ) => {
    await requestPasswordReset(req.body.email);

    /*
     * ข้อความเดียวกันเสมอ
     * ไม่บอกว่าอีเมลมีบัญชีหรือไม่
     */
    res.status(200).json({
      success: true,
      message:
        "หากอีเมลนี้มีบัญชีอยู่ในระบบ เราได้ส่งรหัส OTP ไปแล้ว",
    });
  },
);

export const resetPasswordController = asyncHandler(
  async (
    req: Request<object, object, ResetPasswordBody>,
    res: Response,
  ) => {
    await resetPasswordWithOtp(req.body);

    res.status(200).json({
      success: true,
      message: "ตั้งรหัสผ่านใหม่สำเร็จ",
    });
  },
);