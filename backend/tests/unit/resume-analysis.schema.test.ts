import { describe, expect, it } from "vitest";

import {
  resumeAnalysisResultSchema,
} from "../../src/modules/analysis/resume-analysis.schema.js";

function createValidResult() {
  return {
    baseResumeScore: 80,
    jobMatchScore: null,
    scores: {
      contactInformation: 8,
      professionalSummary: 12,
      skills: 16,
      experience: 20,
      projects: 8,
      education: 8,
      readability: 8,
    },
    jobMatch: null,
    summary: "Resume มีโครงสร้างที่ดี",
    strengths: [
      "มีประสบการณ์ Backend",
    ],
    weaknesses: [
      "รายละเอียดบางส่วนยังไม่ชัดเจน",
    ],
    recommendations: [
      "เพิ่มผลลัพธ์เชิงปริมาณ",
    ],
  };
}

describe(
  "resumeAnalysisResultSchema",
  () => {
    it(
      "accepts a valid BASE result",
      () => {
        const result =
          resumeAnalysisResultSchema.safeParse(
            createValidResult(),
          );

        expect(result.success).toBe(true);
      },
    );

    it(
      "rejects extra top-level fields",
      () => {
        const result =
          resumeAnalysisResultSchema.safeParse({
            ...createValidResult(),
            overallScore: 80,
          });

        expect(result.success).toBe(false);
      },
    );

    it(
      "rejects extra score fields",
      () => {
        const valid =
          createValidResult();

        const result =
          resumeAnalysisResultSchema.safeParse({
            ...valid,
            scores: {
              ...valid.scores,
              jobRelevance: 5,
            },
          });

        expect(result.success).toBe(false);
      },
    );

    it(
      "rejects when baseResumeScore does not equal section total",
      () => {
        const result =
          resumeAnalysisResultSchema.safeParse({
            ...createValidResult(),
            baseResumeScore: 90,
          });

        expect(result.success).toBe(false);
      },
    );

    it(
      "rejects jobMatchScore when jobMatch is null",
      () => {
        const result =
          resumeAnalysisResultSchema.safeParse({
            ...createValidResult(),
            jobMatchScore: 80,
          });

        expect(result.success).toBe(false);
      },
    );

    it(
      "rejects when jobMatchScore does not equal jobMatch.score",
      () => {
        const result =
          resumeAnalysisResultSchema.safeParse({
            ...createValidResult(),
            jobMatchScore: 85,
            jobMatch: {
              score: 80,
              matchedSkills: [
                "Node.js",
              ],
              missingSkills: [
                "Docker",
              ],
              keywordMatches: [
                "Backend",
              ],
            },
          });

        expect(result.success).toBe(false);
      },
    );

    it(
      "accepts a valid JOB_MATCH result",
      () => {
        const result =
          resumeAnalysisResultSchema.safeParse({
            ...createValidResult(),
            jobMatchScore: 85,
            jobMatch: {
              score: 85,
              matchedSkills: [
                "Node.js",
              ],
              missingSkills: [
                "Docker",
              ],
              keywordMatches: [
                "Backend",
              ],
            },
          });

        expect(result.success).toBe(true);
      },
    );
  },
);