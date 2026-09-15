import { Router } from "express";

import { authenticateToken } from "../../middleware/auth.middleware.js";

import {
  resumeUpload,
  verifyUploadedResumePdf,
} from "../../middleware/resume-upload.middleware.js";

import {
  createResumeAnalysisRunController,
  getResumeAnalysisHistoryController,
} from "../analysis/resume-analysis-run.controller.js";

import {
  createAnalysisRunBodySchema,
} from "../analysis/resume-analysis-run.validation.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  createResumeChunksController,
  createResumeEmbeddingsController,
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
  verifyUploadedResumePdf,
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

resumeRouter.post(
  "/:resumeId/embeddings",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
  }),
  createResumeEmbeddingsController,
);

resumeRouter.post(
  "/:resumeId/analyses",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
    body: createAnalysisRunBodySchema,
  }),
  createResumeAnalysisRunController,
);

resumeRouter.get(
  "/:resumeId/analyses",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
  }),
  getResumeAnalysisHistoryController,
);