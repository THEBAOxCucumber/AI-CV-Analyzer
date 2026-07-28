import type {
  NextFunction,
  Request,
  Response,
} from "express";
import jwt, { type JwtPayload } from "jsonwebtoken";

import { env } from "../config/env.js";
import { AppError } from "../errors/app-error.js";
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
  _res: Response,
  next: NextFunction,
): Promise<void> {
  try {
    const authorizationHeader = req.headers.authorization;

    if (!authorizationHeader) {
      throw new AppError(
        "กรุณาเข้าสู่ระบบ",
        401,
        "TOKEN_REQUIRED",
      );
    }

    const [scheme, token] = authorizationHeader.split(" ");

    if (scheme !== "Bearer" || !token) {
      throw new AppError(
        "รูปแบบ Token ไม่ถูกต้อง",
        401,
        "INVALID_TOKEN_FORMAT",
      );
    }

    const decoded = jwt.verify(token, env.jwt.secret);

    if (!isAccessTokenPayload(decoded)) {
      throw new AppError(
        "ข้อมูลใน Token ไม่ถูกต้อง",
        401,
        "INVALID_TOKEN_PAYLOAD",
      );
    }

    const userId = Number(decoded.sub);

    if (!Number.isInteger(userId) || userId <= 0) {
      throw new AppError(
        "รหัสผู้ใช้ใน Token ไม่ถูกต้อง",
        401,
        "INVALID_USER_ID",
      );
    }

    const user = await findUserById(userId);

    if (!user) {
      throw new AppError(
        "ไม่พบบัญชีผู้ใช้",
        401,
        "USER_NOT_FOUND",
      );
    }

    req.user = {
      id: user.id,
      email: user.email,
      role: user.role,
    };

    next();
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      next(
        new AppError(
          "Token หมดอายุ กรุณาเข้าสู่ระบบอีกครั้ง",
          401,
          "TOKEN_EXPIRED",
        ),
      );
      return;
    }

    if (error instanceof jwt.JsonWebTokenError) {
      next(
        new AppError(
          "Token ไม่ถูกต้อง",
          401,
          "INVALID_TOKEN",
        ),
      );
      return;
    }

    next(error);
  }
}