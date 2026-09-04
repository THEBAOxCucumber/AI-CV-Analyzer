import { z } from "zod";

const scoreSchema = z
  .number()
  .int()
  .min(0)
  .max(100);

const baseScorePartSchema = z
  .number()
  .int()
  .min(0);


export const resumeAnalysisResultSchema =
  z.object({
    baseResumeScore: scoreSchema,

    jobMatchScore:
      scoreSchema.nullable(),

    scores: z
      .object({
        contactInformation:
          baseScorePartSchema.max(10),

        professionalSummary:
          baseScorePartSchema.max(15),

        skills:
          baseScorePartSchema.max(20),

        experience:
          baseScorePartSchema.max(25),

        projects:
          baseScorePartSchema.max(10),

        education:
          baseScorePartSchema.max(10),

        readability:
          baseScorePartSchema.max(10),
      })
      .strict(),

    jobMatch: z
      .object({
        score: scoreSchema,

        matchedSkills: z.array(
          z.string().min(1),
        ),

        missingSkills: z.array(
          z.string().min(1),
        ),

        keywordMatches: z.array(
          z.string().min(1),
        ),
      })
      .nullable(),

    summary: z.string().min(1),

    strengths: z.array(
      z.string().min(1),
    ),

    weaknesses: z.array(
      z.string().min(1),
    ),

    recommendations: z.array(
      z.string().min(1),
    ),
  })
    .strict()
    .superRefine((result, context) => {
      const total = Object.values(
        result.scores,
      ).reduce(
        (sum, score) => sum + score,
        0,
      );

      if (
        total !== result.baseResumeScore
      ) {
        context.addIssue({
          code: "custom",
          path: ["baseResumeScore"],
          message:
            `Base score must equal section total: ${total}`,
        });
      }

      if (
        result.jobMatch === null &&
        result.jobMatchScore !== null
      ) {
        context.addIssue({
          code: "custom",
          path: ["jobMatchScore"],
          message:
            "jobMatchScore must be null when jobMatch is null",
        });
      }

      if (
        result.jobMatch !== null &&
        result.jobMatchScore !==
        result.jobMatch.score
      ) {
        context.addIssue({
          code: "custom",
          path: ["jobMatchScore"],
          message:
            "jobMatchScore must equal jobMatch.score",
        });
      }
    });

export type ResumeAnalysisResult =
  z.infer<typeof resumeAnalysisResultSchema>;

export type ValidatedResumeAnalysis =
  z.infer<typeof resumeAnalysisResultSchema>;

