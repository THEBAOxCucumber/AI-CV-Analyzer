import { z } from "zod";

export const analyzeResumeBodySchema =
  z.object({
    force: z
      .boolean()
      .optional()
      .default(false),
  })
  .strict();

export type AnalyzeResumeBody =
  z.infer<
    typeof analyzeResumeBodySchema
  >;