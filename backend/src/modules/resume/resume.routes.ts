import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";
import { resumeUpload } from "../../middleware/resume-upload.middleware.js";

import { validate } from "../../middleware/validate.middleware.js";
import {
  createResumeChunksController,
  getResumeChunksController,
  getMyResumesController,
  uploadResumeController,
} from "./resume.controller.js";
import { resumeIdParamsSchema } from "./resume.validation.js";

export const resumeRouter = Router();

resumeRouter.get(
  "/",
  authenticateToken,
  getMyResumesController,
);

resumeRouter.post(
  "/upload",
  authenticateToken,
  resumeUpload.single("resume"),
  uploadResumeController,
);

resumeRouter.post(
  "/:resumeId/chunks",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
  }),
  createResumeChunksController,
);

resumeRouter.get(
  "/:resumeId/chunks",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
  }),
  getResumeChunksController,
);