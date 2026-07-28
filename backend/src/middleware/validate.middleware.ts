import type {
  NextFunction,
  Request,
  Response,
} from "express";
import type { ZodType } from "zod";

import { AppError } from "../errors/app-error.js";

interface ValidationSchemas {
  body?: ZodType;
  params?: ZodType;
  query?: ZodType;
}

export function validate(schemas: ValidationSchemas) {
  return (
    req: Request,
    _res: Response,
    next: NextFunction,
  ): void => {
    const validationErrors: Record<string, unknown> = {};

    if (schemas.body) {
      const result = schemas.body.safeParse(req.body);

      if (!result.success) {
        validationErrors.body = result.error.flatten();
      } else {
        req.body = result.data;
      }
    }

    if (schemas.params) {
      const result = schemas.params.safeParse(req.params);

      if (!result.success) {
        validationErrors.params = result.error.flatten();
      } else {
        Object.assign(req.params, result.data);
      }
    }

    if (schemas.query) {
      const result = schemas.query.safeParse(req.query);

      if (!result.success) {
        validationErrors.query = result.error.flatten();
      } else {
        Object.assign(req.query, result.data);
      }
    }

    if (Object.keys(validationErrors).length > 0) {
      next(
        new AppError(
          "ข้อมูลที่ส่งมาไม่ถูกต้อง",
          400,
          "VALIDATION_ERROR",
          validationErrors,
        ),
      );
      return;
    }

    next();
  };
}