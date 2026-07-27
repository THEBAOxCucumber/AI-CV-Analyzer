import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "../config/env.js";
import { findUserById } from "../modules/auth/auth.repository.js";

interface AccessTokenPayload extends JwtPayload {
  sub: string;
  email: string;
  role: "USER" | "ADMIN";
}

function isAccessTokenPayload(
  payload: string | JwtPayload,
): payload is AccessTokenPayload {
  if (typeof payload === "string") {
    return false;
  }

  return (
    typeof payload.sub === "string" &&
    typeof payload.email === "string" &&
    (payload.role === "USER" || payload.role === "ADMIN")
  );
}

export async function authenticateToken(
  req: Request,
  res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      res.status(401).json({
        success: false,
        message: "กรุณาเข้าสู่ระบบ",
      });
      return;
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      res.status(401).json({
        success: false,
        message: "รูปแบบ Token ไม่ถูกต้อง",
      });
      return;
    }

    const decoded = jwt.verify(token, env.jwt.secret);

    if (!isAccessTokenPayload(decoded)) {
      res.status(401).json({
        success: false,
        message: "ข้อมูลใน Token ไม่ถูกต้อง",
      });
      return;
    }

    const userId = Number(decoded.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      res.status(401).json({
        success: false,
        message: "รหัสผู้ใช้ใน Token ไม่ถูกต้อง",
      });
      return;
    }

    const user = await findUserById(userId);

    if (!user) {
      res.status(401).json({
        success: false,
        message: "ไม่พบบัญชีผู้ใช้",
      });
      return;
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      res.status(401).json({
        success: false,
        message: "Token หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
      });
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      res.status(401).json({
        success: false,
        message: "Token ไม่ถูกต้อง",
      });
      return;
    }

    console.error("Authentication error:", error);

    res.status(500).json({
      success: false,
      message: "เกิดข้อผิดพลาดในการตรวจสอบสิทธิ์",
    });
  }
}