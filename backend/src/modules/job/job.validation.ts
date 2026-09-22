import { z } from "zod";

export const searchJobsQuerySchema =
  z.object({
    keywords:
      z.string()
        .trim()
        .min(1)
        .max(200),

    location:
      z.string()
        .trim()
        .max(200)
        .optional(),

    page:
      z.coerce
        .number()
        .int()
        .min(1)
        .default(1),

    pageSize:
      z.coerce
        .number()
        .int()
        .min(1)
        .max(50)
        .default(20),
  });

export const importJobBodySchema =
  z.object({
    externalJobId:
      z.string()
        .length(64),

    title:
      z.string()
        .trim()
        .min(1)
        .max(500),

    company:
      z.string()
        .trim()
        .max(255)
        .nullable(),

    description:
      z.string()
        .trim()
        .min(1),

    location:
      z.string()
        .trim()
        .max(255),

    salary:
      z.string()
        .trim()
        .max(255)
        .nullable(),

    postedAt:
      z.string()
        .nullable(),

    sourceUrl:
      z.string()
        .url(),

    source:
      z.literal("CAREERJET"),
  });

