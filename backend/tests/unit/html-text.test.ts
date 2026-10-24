import { describe, expect, it } from "vitest";

import {
  toPlainText,
} from "../../src/modules/job/providers/html-text.js";

describe("toPlainText", () => {
  it("removes highlight tags from Careerjet", () => {
    expect(
      toPlainText(
        "Senior <b>Software</b> <b>Developer</b>",
      ),
    ).toBe("Senior Software Developer");
  });

  it("decodes common HTML entities", () => {
    expect(
      toPlainText(
        "R&amp;D &lt;Team&gt; &quot;A&quot; &#39;B&#39; &#x2713;",
      ),
    ).toBe("R&D <Team> \"A\" 'B' ✓");
  });

  it("turns line breaks and extra whitespace into single spaces", () => {
    expect(
      toPlainText(
        "  line one<br/>line two&nbsp;&nbsp;\n\n end ",
      ),
    ).toBe("line one line two end");
  });

  it("keeps a '<' that is never closed, like the old regex", () => {
    expect(toPlainText("x < y")).toBe("x < y");
    expect(toPlainText("<b>React</b> a<b<c>d")).toBe("React ad");
  });

  it("stays fast on many unclosed '<' (no backtracking)", () => {
    const started = Date.now();
    toPlainText(`${"<".repeat(50_000)}x`);
    expect(Date.now() - started).toBeLessThan(100);
  });

  it("keeps Thai text intact", () => {
    expect(
      toPlainText(
        "นักพัฒนา <b>Backend</b> กรุงเทพฯ",
      ),
    ).toBe("นักพัฒนา Backend กรุงเทพฯ");
  });
});
