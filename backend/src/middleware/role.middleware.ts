import type {
  NextFunction,
  Request,
  Response,
} from "express";

import type { UserRole } from "../modules/auth/auth.types.js";

export function authorizeRoles(...allowedRoles: UserRole[]) {
  return (
    req: Request,
    res: Response,
    next: NextFunction,
  ): void => {
    if (!req.user) {
      res.status(401).json({
        success: false,
        message: "กรุณาเข้าสู่ระบบ",
      });
      return;
    }

    if (!allowedRoles.includes(req.user.role)) {
      res.status(403).json({
        success: false,
        message: "คุณไม่มีสิทธิ์เข้าถึงข้อมูลนี้",
      });
      return;
    }

    next();
  };
}