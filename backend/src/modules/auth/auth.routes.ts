import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import {
  authIpRateLimit,
  loginRateLimit,
} from "../../middleware/rate-limit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  changePasswordController,
  forgotPasswordController,
  getMeController,
  loginController,
  registerController,
  resetPasswordController,
} from "./auth.controller.js";
import {
  changePasswordSchema,
  forgotPasswordSchema,
  loginSchema,
  registerSchema,
  resetPasswordSchema,
} from "./auth.validation.js";

export const authRouter = Router();

authRouter.post(
  "/register",
  authIpRateLimit,
  validate({ body: registerSchema }),
  registerController,
);

authRouter.post(
  "/login",
  authIpRateLimit,
  validate({ body: loginSchema }),
  loginRateLimit,
  loginController,
);

authRouter.get(
  "/me",
  authenticateToken,
  getMeController,
);

authRouter.post(
  "/change-password",
  authenticateToken,
  validate({ body: changePasswordSchema }),
  changePasswordController,
);

authRouter.post(
  "/forgot-password",
  authIpRateLimit,
  validate({ body: forgotPasswordSchema }),
  forgotPasswordController,
);

authRouter.post(
  "/reset-password",
  authIpRateLimit,
  validate({ body: resetPasswordSchema }),
  resetPasswordController,
);