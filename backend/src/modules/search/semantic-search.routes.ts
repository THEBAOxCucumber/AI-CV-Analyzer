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
  searchResumeController,
} from "./semantic-search.controller.js";
import {
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

// /:resumeId/ask (ถาม-ตอบด้วย Gemini) ถูกเอาออก — ส่ง Resume ออกนอกเครื่อง และหน้าเว็บไม่ได้ใช้