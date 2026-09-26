import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
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
  validate({ body: registerSchema }),
  registerController,
);

authRouter.post(
  "/login",
  validate({ body: loginSchema }),
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
  validate({ body: forgotPasswordSchema }),
  forgotPasswordController,
);

authRouter.post(
  "/reset-password",
  validate({ body: resetPasswordSchema }),
  resetPasswordController,
);