import { Router } from "express";

import {
  authenticateToken,
} from "../../middleware/auth.middleware.js";

import {
  validate,
} from "../../middleware/validate.middleware.js";

import {
  getAnalysisRunController,
} from "./resume-analysis-run.controller.js";

import {
  analysisRunIdParamsSchema,
} from "./resume-analysis-run.validation.js";

export const analysisRouter =
  Router();

analysisRouter.get(
  "/:analysisRunId",
  authenticateToken,
  validate({
    params:
      analysisRunIdParamsSchema,
  }),
  getAnalysisRunController,
);

