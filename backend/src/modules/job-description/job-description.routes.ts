import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import { createJobDescriptionController } from "./job-description.controller.js";
import { createJobDescriptionBodySchema } from "./job-description.validation.js";

export const jobDescriptionRouter =
  Router();

jobDescriptionRouter.post(
  "/",
  authenticateToken,
  validate({
    body: createJobDescriptionBodySchema,
  }),
  createJobDescriptionController,
);