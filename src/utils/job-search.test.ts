import {
  describe,
  expect,
  it,
} from "vitest"

import {
  buildJobSearchPath,
} from "./job-search"

describe("buildJobSearchPath", () => {
  it("keeps the resume and encodes the keywords", () => {
    expect(buildJobSearchPath(12, "Frontend Developer")).toBe(
      "/jobs?resume=12&q=Frontend+Developer",
    )
  })

  it("omits an empty or missing keyword", () => {
    expect(buildJobSearchPath(5, "  ")).toBe("/jobs?resume=5")
    expect(buildJobSearchPath(5)).toBe("/jobs?resume=5")
  })
})
