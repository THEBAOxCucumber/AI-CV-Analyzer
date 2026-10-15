import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeResumeAnalysisResult,
  resumeMentionsSkill,
} from "../../src/modules/analysis/resume-analysis-normalizer.js";

function jobMatchOf(result: unknown) {
  return (result as { jobMatch: Record<string, string[]> }).jobMatch;
}

const RESUME = `
  Backend developer, 3 years with Node.js, TypeScript and MySQL.
  Built REST APIs, used Redis and Docker. Some CI/CD with GitHub Actions.
`;

describe("resumeMentionsSkill", () => {
  it.each([
    ["Node.js", true],
    ["node.js", true],
    ["CI/CD", true],
    ["Redis", true],
    ["Java", false], // ไม่นับใน "JavaScript" — resume นี้ไม่มีทั้งคู่
    ["AWS", false],
  ])("%s → %s", (skill, expected) => {
    expect(resumeMentionsSkill(RESUME, skill)).toBe(expected);
  });

  it("does not match a skill inside a longer word", () => {
    expect(resumeMentionsSkill("Senior JavaScript engineer", "Java")).toBe(false);
  });
});

describe("normalizeResumeAnalysisResult — job match skills", () => {
  it("removes a conflicting skill from missingSkills when the resume mentions it", () => {
    const result = normalizeResumeAnalysisResult(
      {
        jobMatch: {
          score: 70,
          matchedSkills: ["Node.js"],
          missingSkills: ["Docker", "AWS"],
          keywordMatches: ["Docker"],
        },
      },
      { resumeText: RESUME },
    );

    expect(jobMatchOf(result)).toMatchObject({
      matchedSkills: ["Node.js"],
      missingSkills: ["AWS"],
      keywordMatches: ["Docker"],
    });
  });

  it("removes a conflicting skill from matched/keywords when the resume does not mention it", () => {
    const result = normalizeResumeAnalysisResult(
      {
        jobMatch: {
          score: 60,
          matchedSkills: ["React", "Node.js"],
          missingSkills: ["React", "Testing"],
          keywordMatches: ["Testing", "MySQL"],
        },
      },
      { resumeText: RESUME },
    );

    expect(jobMatchOf(result)).toMatchObject({
      matchedSkills: ["Node.js"],
      missingSkills: ["React", "Testing"],
      keywordMatches: ["MySQL"],
    });
  });

  it("trims, drops empty values and de-duplicates case-insensitively", () => {
    const result = normalizeResumeAnalysisResult({
      jobMatch: {
        score: 50,
        matchedSkills: [" Docker ", "docker", ""],
        missingSkills: ["AWS", "aws "],
        keywordMatches: [],
      },
    });

    expect(jobMatchOf(result)).toMatchObject({
      matchedSkills: ["Docker"],
      missingSkills: ["AWS"],
      keywordMatches: [],
    });
  });

  it("without resume text, does not claim a conflicting skill as matched", () => {
    const result = normalizeResumeAnalysisResult({
      jobMatch: {
        score: 50,
        matchedSkills: ["Git"],
        missingSkills: ["Git"],
        keywordMatches: [],
      },
    });

    expect(jobMatchOf(result)).toMatchObject({
      matchedSkills: [],
      missingSkills: ["Git"],
    });
  });

  it("keeps the AI score and does not mutate the input", () => {
    const input = {
      jobMatch: {
        score: 75,
        matchedSkills: ["Git"],
        missingSkills: ["Git"],
        keywordMatches: [],
      },
    };

    const result = normalizeResumeAnalysisResult(input, { resumeText: "git" }) as {
      jobMatchScore: number;
    };

    expect(result.jobMatchScore).toBe(75);
    expect(input.jobMatch.missingSkills).toEqual(["Git"]);
  });
});
