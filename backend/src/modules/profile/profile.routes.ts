import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  getProfileController,
  updateProfileController,
} from "./profile.controller.js";
import { updateProfileSchema } from "./profile.validation.js";

export const profileRouter = Router();

profileRouter.get(
  "/",
  authenticateToken,
  getProfileController,
);

profileRouter.put(
  "/",
  authenticateToken,
  validate({ body: updateProfileSchema }),
  updateProfileController,
);