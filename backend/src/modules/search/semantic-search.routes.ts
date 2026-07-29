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
  askResumeController,
  searchResumeController,
} from "./semantic-search.controller.js";
import {
  resumeQuestionBodySchema,
  semanticSearchBodySchema,
} from "./semantic-search.validation.js";

export const semanticSearchRouter = Router();

semanticSearchRouter.post(
  "/:resumeId/search",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
    body: semanticSearchBodySchema,
  }),
  searchResumeController,
);

semanticSearchRouter.post(
  "/:resumeId/ask",
  authenticateToken,
  validate({
    params: resumeIdParamsSchema,
    body: resumeQuestionBodySchema,
  }),
  askResumeController,
);