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

  it("keeps Thai text intact", () => {
    expect(
      toPlainText(
        "นักพัฒนา <b>Backend</b> กรุงเทพฯ",
      ),
    ).toBe("นักพัฒนา Backend กรุงเทพฯ");
  });
});
