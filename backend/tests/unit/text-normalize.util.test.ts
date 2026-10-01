import {
  describe,
  expect,
  it,
} from "vitest";

import {
  normalizeExtractedText,
  trimEndChars,
} from "../../src/utils/text-normalize.util.js";

/*
 * regex เดิม (มีปัญหา ReDoS) ใช้เทียบผลกับข้อความสั้นเท่านั้น
 */
function legacyNormalize(text: string): string {
  return text
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/[ \t]{2,}/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

describe("normalizeExtractedText", () => {
  it.each([
    "Name  Surname \t\r\nSkills:\t\n\n\n\nNode.js",
    "line1\rline2\r\n\r\n\r\n\r\nline3   ",
    "  ทักษะ   \n\n\n\n\nประสบการณ์\t \t\n",
    "\t \n \t\n",
    "",
  ])("matches legacy output for %j", (input) => {
    expect(normalizeExtractedText(input)).toBe(
      legacyNormalize(input),
    );
  });

  it("handles long whitespace runs without newline in linear time", () => {
    const attack = `${" \t".repeat(100_000)}x`;
    const startedAt = performance.now();

    expect(normalizeExtractedText(attack)).toBe("x");
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});

describe("trimEndChars", () => {
  const marks = new Set([":", "：", "-", "–", "—"]);

  it("removes only trailing marks", () => {
    expect(trimEndChars("Skills:—", marks)).toBe("Skills");
    expect(trimEndChars("Front-end", marks)).toBe("Front-end");
    expect(trimEndChars(":::", marks)).toBe("");
  });

  it("handles long runs of marks not at the end quickly", () => {
    const attack = `${":".repeat(200_000)}x`;
    const startedAt = performance.now();

    expect(trimEndChars(attack, marks)).toBe(attack);
    expect(performance.now() - startedAt).toBeLessThan(500);
  });
});
