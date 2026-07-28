import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getMeController,
  loginController,
  registerController,
} from "./auth.controller.js";
import {
  loginSchema,
  registerSchema,
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