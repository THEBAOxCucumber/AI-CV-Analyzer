import { z } from "zod";

export const createJobDescriptionBodySchema =
  z.object({
    title: z
      .string()
      .trim()
      .max(255)
      .optional(),

    company: z
      .string()
      .trim()
      .max(255)
      .optional(),

    description: z
      .string()
      .trim()
      .min(
        1,
        "กรุณาระบุ Job Description",
      ),
  });