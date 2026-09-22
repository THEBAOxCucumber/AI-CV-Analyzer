import {
  Router,
} from "express";

import { 
    authenticateToken,
} from "../../middleware/auth.middleware.js";

import { 
    validate,
} from "../../middleware/validate.middleware.js";

import {
    importJobController,
  searchJobsController,
} from "./job.controller.js";

import {
    importJobBodySchema,
  searchJobsQuerySchema,
} from "./job.validation.js";

export const jobRouter =
  Router();

jobRouter.get(
  "/",
  authenticateToken,
  validate({
    query:
      searchJobsQuerySchema,
  }),
  searchJobsController,
);

jobRouter.post(
  "/import",
  authenticateToken,
  validate({
    body:
      importJobBodySchema,
  }),
  importJobController,
);