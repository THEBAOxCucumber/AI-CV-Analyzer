import type {
  Request,
  Response,
} from "express";
import { flattenError, type ZodType, type z } from "zod";

import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  cancelStuckAnalysis,
  changeUserRole,
  getAnalyses,
  getAuditLogs,
  getOverview,
  getSystemStatus,
  getTrends,
  getUsers,
  promoteAdminByEmail,
  retryFailedAnalysis,
  unlockUserLogin,
} from "./admin.service.js";
import type { AdminActor } from "./admin.types.js";
import {
  changeRoleBodySchema,
  listAnalysesQuerySchema,
  listAuditLogsQuerySchema,
  listUsersQuerySchema,
  promoteAdminBodySchema,
  trendsQuerySchema,
} from "./admin.validation.js";

/*
 * ผู้กระทำสำหรับ audit log (req.ip ผ่าน trust proxy แล้ว)
 */
function requireActor(req: Request): AdminActor {
  if (!req.user) {
    throw new AppError("กรุณาเข้าสู่ระบบ", 401, "UNAUTHENTICATED");
  }

  return {
    id: req.user.id,
    email: req.user.email,
    ip: req.ip ?? null,
  };
}

/*
 * Express 5: req.query เป็น getter (แก้ค่าทับไม่ได้) → parse เองที่นี่
 */
function parseQuery<T extends ZodType>(
  schema: T,
  req: Request,
): z.infer<T> {
  const result = schema.safeParse(req.query);

  if (!result.success) {
    throw new AppError(
      "ข้อมูลที่ส่งมาไม่ถูกต้อง",
      400,
      "VALIDATION_ERROR",
      { query: flattenError(result.error) },
    );
  }

  return result.data;
}

function getIdParam(req: Request): number {
  // ผ่าน validate({ params: idParamsSchema }) แล้ว
  return Number(req.params.id);
}

export const getOverviewController = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json({ success: true, data: await getOverview() });
  },
);

export const getSystemStatusController = asyncHandler(
  async (_req: Request, res: Response) => {
    res.json({ success: true, data: await getSystemStatus() });
  },
);

export const getTrendsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = parseQuery(trendsQuerySchema, req);

    res.json({ success: true, data: await getTrends(query.days) });
  },
);

export const listUsersController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = parseQuery(listUsersQuerySchema, req);

    res.json({
      success: true,
      data: await getUsers(query.search, query.page, query.pageSize),
    });
  },
);

export const listAnalysesController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = parseQuery(listAnalysesQuerySchema, req);

    res.json({
      success: true,
      data: await getAnalyses(query.status, query.page, query.pageSize),
    });
  },
);

export const listAuditLogsController = asyncHandler(
  async (req: Request, res: Response) => {
    const query = parseQuery(listAuditLogsQuerySchema, req);

    res.json({
      success: true,
      data: await getAuditLogs(query.page, query.pageSize),
    });
  },
);

export const retryAnalysisController = asyncHandler(
  async (req: Request, res: Response) => {
    const analysisRun = await retryFailedAnalysis(
      requireActor(req),
      getIdParam(req),
    );

    res.status(201).json({
      success: true,
      message: "เริ่มวิเคราะห์ใหม่แล้ว",
      data: { analysisRun },
    });
  },
);

export const cancelAnalysisController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await cancelStuckAnalysis(
      requireActor(req),
      getIdParam(req),
    );

    res.json({
      success: true,
      message: "ยกเลิกงานที่ค้างแล้ว",
      data: result,
    });
  },
);

export const unlockLoginController = asyncHandler(
  async (req: Request, res: Response) => {
    const result = await unlockUserLogin(
      requireActor(req),
      getIdParam(req),
    );

    res.json({
      success: true,
      message: "ปลดล็อกการเข้าสู่ระบบแล้ว",
      data: result,
    });
  },
);

export const promoteAdminController = asyncHandler(
  async (req: Request, res: Response) => {
    const { email } = req.body as z.infer<typeof promoteAdminBodySchema>;

    const result = await promoteAdminByEmail(
      requireActor(req),
      email,
    );

    res.json({
      success: true,
      message: result.alreadyAdmin
        ? `${result.email} เป็น Admin อยู่แล้ว`
        : `ตั้ง ${result.email} เป็น Admin แล้ว`,
      data: result,
    });
  },
);

export const changeRoleController = asyncHandler(
  async (req: Request, res: Response) => {
    const { role } = req.body as z.infer<typeof changeRoleBodySchema>;

    const result = await changeUserRole(
      requireActor(req),
      getIdParam(req),
      role,
    );

    res.json({
      success: true,
      message: "เปลี่ยน role แล้ว",
      data: result,
    });
  },
);
