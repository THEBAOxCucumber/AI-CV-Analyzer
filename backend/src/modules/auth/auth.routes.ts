import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import {
  getMeController,
  loginController,
  registerController,
} from "./auth.controller.js";

export const authRouter = Router();

authRouter.post("/register", registerController);
authRouter.post("/login", loginController);

authRouter.get(
  "/me",
  authenticateToken,
  getMeController,
);