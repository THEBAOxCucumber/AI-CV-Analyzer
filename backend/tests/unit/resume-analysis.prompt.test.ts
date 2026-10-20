import {
  describe,
  expect,
  it,
} from "vitest";

import {
  buildResumeAnalysisPrompt,
} from "../../src/modules/analysis/resume-analysis.prompt.js";

const input = {
  analysisType: "BASE" as const,
  jobDescription: null,
  chunks: [
    {
      id: 1,
      chunkIndex: 0,
      section: "experience",
      content: "Frontend developer intern, React and TypeScript",
    },
  ],
} as unknown as Parameters<typeof buildResumeAnalysisPrompt>[0];

describe("buildResumeAnalysisPrompt", () => {
  it("v2.1.0 asks for suggested job titles in English", () => {
    const prompt = buildResumeAnalysisPrompt(input, "resume-analysis-v2.1.0");

    expect(prompt).toContain("\"suggestedJobTitles\": string[]");
    expect(prompt).toContain("กฎสำหรับ suggestedJobTitles");
  });

  it("v2.0.0 stays unchanged (no job titles)", () => {
    const prompt = buildResumeAnalysisPrompt(input, "resume-analysis-v2.0.0");

    expect(prompt).not.toContain("suggestedJobTitles");
  });

  it("rejects an unknown prompt version", () => {
    expect(() => buildResumeAnalysisPrompt(input, "resume-analysis-v9")).toThrow();
  });
});
