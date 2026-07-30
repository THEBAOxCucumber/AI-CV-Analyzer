import { Router } from "express";

import {
  authenticateToken,
} from "../../middleware/auth.middleware.js";
import {
  validate,
} from "../../middleware/validate.middleware.js";
import {
  resumeIdParamsSchema,
} from "../resume/resume.validation.js";
import {
  analyzeResumeController,
  getResumeAnalysisController,
} from "./resume-analysis.controller.js";
import {
  analyzeResumeBodySchema,
} from "./resume-analysis.validation.js";

export const resumeAnalysisRouter =
  Router();

resumeAnalysisRouter.post(
  "/:resumeId/analyze",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
    body: analyzeResumeBodySchema,
  }),
  analyzeResumeController,
);

resumeAnalysisRouter.get(
  "/:resumeId/analysis",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
  }),
  getResumeAnalysisController,
);