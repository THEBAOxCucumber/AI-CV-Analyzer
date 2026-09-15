import { Router } from "express";

import type {
  NextFunction,
  Request,
  Response,
} from "express";

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

function legacyAnalysisDeprecation(
  _req: Request,
  res: Response,
  next: NextFunction,
): void {
  res.setHeader(
    "Deprecation",
    "true",
  );

  res.setHeader(
    "Sunset",
    "Wed, 31 Dec 2026 23:59:59 GMT",
  );

  res.setHeader(
    "Link",
    '</api/resumes/:resumeId/analyses>; rel="successor-version"',
  );

  next();
}

resumeAnalysisRouter.post(
  "/:resumeId/analyze",
  legacyAnalysisDeprecation,
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
    body: analyzeResumeBodySchema,
  }),
  analyzeResumeController,
);

resumeAnalysisRouter.get(
  "/:resumeId/analysis",
  legacyAnalysisDeprecation,
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
  }),
  getResumeAnalysisController,
);