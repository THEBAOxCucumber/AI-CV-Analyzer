import { z } from "zod";

export const semanticSearchBodySchema = z.object({
  query: z
    .string()
    .trim()
    .min(2, "คำค้นต้องมีอย่างน้อย 2 ตัวอักษร")
    .max(500, "คำค้นต้องไม่เกิน 500 ตัวอักษร"),

  limit: z.coerce
    .number()
    .int()
    .min(1)
    .max(10)
    .optional(),

  scoreThreshold: z.coerce
    .number()
    .min(-1)
    .max(1)
    .optional(),
});
