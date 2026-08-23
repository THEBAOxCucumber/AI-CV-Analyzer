import { z } from "zod";

export const createAnalysisRunBodySchema = z
  .object({
    analysisType: z.enum([
      "BASE",
      "JOB_MATCH",
      "COMBINED",
    ]),

    jobDescriptionId: z.coerce
      .number()
      .int()
      .positive()
      .optional(),
  })
  .superRefine((data, ctx) => {
    if (
      (data.analysisType === "JOB_MATCH" ||
        data.analysisType === "COMBINED") &&
      !data.jobDescriptionId
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["jobDescriptionId"],
        message:
          "ต้องระบุ jobDescriptionId สำหรับ JOB_MATCH หรือ COMBINED",
      });
    }

    if (
      data.analysisType === "BASE" &&
      data.jobDescriptionId !== undefined
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["jobDescriptionId"],
        message:
          "BASE analysis ไม่ต้องระบุ jobDescriptionId",
      });
    }
  });

export const analysisRunIdParamsSchema =
  z.object({
    analysisRunId: z.coerce
      .number()
      .int()
      .positive(),
  });