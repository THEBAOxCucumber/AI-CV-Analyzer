import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { authorizeRoles } from "../../middleware/role.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  cancelAnalysisController,
  changeRoleController,
  getOverviewController,
  getSystemStatusController,
  getTrendsController,
  listAnalysesController,
  listAuditLogsController,
  listUsersController,
  promoteAdminController,
  retryAnalysisController,
  unlockLoginController,
} from "./admin.controller.js";
import {
  changeRoleBodySchema,
  idParamsSchema,
  promoteAdminBodySchema,
} from "./admin.validation.js";

/*
 * ทุก route: ต้องล็อกอิน + role ADMIN
 * (authenticateToken โหลด role จาก DB ทุก request → ถอดสิทธิ์มีผลทันที)
 */
export const adminRouter = Router();

adminRouter.use(
  authenticateToken,
  authorizeRoles("ADMIN"),
);

adminRouter.get("/overview", getOverviewController);
adminRouter.get("/status", getSystemStatusController);
adminRouter.get("/users", listUsersController);
adminRouter.get("/analyses", listAnalysesController);
adminRouter.get("/trends", getTrendsController);
adminRouter.get("/audit-logs", listAuditLogsController);

adminRouter.post(
  "/analyses/:id/retry",
  validate({ params: idParamsSchema }),
  retryAnalysisController,
);

adminRouter.post(
  "/analyses/:id/cancel",
  validate({ params: idParamsSchema }),
  cancelAnalysisController,
);

adminRouter.post(
  "/users/:id/unlock-login",
  validate({ params: idParamsSchema }),
  unlockLoginController,
);

adminRouter.post(
  "/admins",
  validate({ body: promoteAdminBodySchema }),
  promoteAdminController,
);

adminRouter.patch(
  "/users/:id/role",
  validate({
    params: idParamsSchema,
    body: changeRoleBodySchema,
  }),
  changeRoleController,
);
