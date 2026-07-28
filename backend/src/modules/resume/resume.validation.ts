import { z } from "zod";

export const resumeIdParamsSchema = z.object({
  resumeId: z.coerce
    .number()
    .int("resumeId ต้องเป็นจำนวนเต็ม")
    .positive("resumeId ต้องมากกว่า 0"),
});

export type ResumeIdParams = z.infer<
  typeof resumeIdParamsSchema
>;