import type { Request, Response } from "express";

import {
  getCurrentUser,
  login,
  register,
} from "./auth.service.js";
import type {
  LoginInput,
  RegisterInput,
} from "./auth.types.js";

export async function registerController(
  req: Request<object, object, RegisterInput>,
  res: Response,
): Promise<void> {
  try {
    const result = await register(req.body);

    res.status(201).json({
      success: true,
      message: "สมัครสมาชิกสำเร็จ",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถสมัครสมาชิกได้";

    const statusCode =
      message === "อีเมลนี้ถูกใช้งานแล้ว" ? 409 : 400;

    res.status(statusCode).json({
      success: false,
      message,
    });
  }
}

export async function loginController(
  req: Request<object, object, LoginInput>,
  res: Response,
): Promise<void> {
  try {
    const result = await login(req.body);

    res.status(200).json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      data: result,
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถเข้าสู่ระบบได้";

    res.status(401).json({
      success: false,
      message,
    });
  }
}

export async function getMeController(
  req: Request,
  res: Response,
): Promise<void> {
  try {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "กรุณาเข้าสู่ระบบ",
      });
      return;
    }

    const user = await getCurrentUser(req.user.id);

    res.status(200).json({
      success: true,
      message: "ดึงข้อมูลผู้ใช้สำเร็จ",
      data: {
        user,
      },
    });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : "ไม่สามารถดึงข้อมูลผู้ใช้ได้";

    res.status(404).json({
      success: false,
      message,
    });
  }
}