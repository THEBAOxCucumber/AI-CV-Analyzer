import { z } from "zod";
import { BASE_RESUME_SCORE_LIMITS } from "./resume-analysis-rubric.js";

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
          baseScorePartSchema.max(
            BASE_RESUME_SCORE_LIMITS
              .contactInformation,
          ),

        professionalSummary:
          baseScorePartSchema.max(
            BASE_RESUME_SCORE_LIMITS
              .professionalSummary,
          ),

        skills:
          baseScorePartSchema.max(
            BASE_RESUME_SCORE_LIMITS
              .skills,
          ),

        experience:
          baseScorePartSchema.max(
            BASE_RESUME_SCORE_LIMITS
              .experience,
          ),

        projects:
          baseScorePartSchema.max(
            BASE_RESUME_SCORE_LIMITS
              .projects,
          ),

        education:
          baseScorePartSchema.max(
            BASE_RESUME_SCORE_LIMITS
              .education,
          ),

        readability:
          baseScorePartSchema.max(
            BASE_RESUME_SCORE_LIMITS
              .readability,
          ),
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

