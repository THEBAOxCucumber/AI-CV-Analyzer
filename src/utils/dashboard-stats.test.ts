import { describe, expect, it } from "vitest"

import type { ResumeAnalysisRun } from "../types/analysis"

import {
  getDashboardStats,
  getScoreTone,
  getTopSkills,
} from "./dashboard-stats"

function makeRun(
  overrides: Partial<ResumeAnalysisRun> = {},
): ResumeAnalysisRun {
  return {
    id: 1,
    resumeId: 1,
    userId: 1,
    jobDescriptionId: null,
    job: null,
    analysisType: "BASE",
    status: "COMPLETED",
    baseResumeScore: 70,
    jobMatchScore: null,
    scores: null,
    jobMatch: null,
    summary: null,
    strengths: [],
    weaknesses: [],
    recommendations: [],
    promptVersion: "test",
    model: null,
    attemptCount: 1,
    errorCode: null,
    errorMessage: null,
    createdAt: "2026-10-05T03:00:00.000Z",
    updatedAt: "2026-10-05T03:00:00.000Z",
    ...overrides,
  }
}

describe("getScoreTone", () => {
  it.each([
    [100, "good"],
    [80, "good"],
    [79, "fair"],
    [60, "fair"],
    [59, "low"],
    [0, "low"],
  ] as const)("%i → %s", (score, tone) => {
    expect(getScoreTone(score)).toBe(tone)
  })
})

describe("getDashboardStats", () => {
  const now = new Date("2026-10-15T05:00:00.000Z")

  it("นับเฉพาะงานที่สำเร็จ และเทียบกับเดือนก่อน", () => {
    const stats = getDashboardStats(
      [
        makeRun({ baseResumeScore: 80 }),
        makeRun({ baseResumeScore: 60 }),
        makeRun({ status: "FAILED", baseResumeScore: null }),
        makeRun({ createdAt: "2026-09-10T03:00:00.000Z", baseResumeScore: 50 }),
      ],
      now,
    )

    expect(stats.analyzedCount).toBe(3)
    expect(stats.analyzedThisMonth).toBe(2)
    expect(stats.analyzedChangePercent).toBe(100)
    expect(stats.averageScore).toBe(63)
    expect(stats.averageScoreChange).toBe(20)
  })

  it("แบ่งเดือนตามเวลาไทย ไม่ใช่ UTC", () => {
    // 30 ก.ย. 18:00 UTC = 1 ต.ค. 01:00 เวลาไทย → นับเป็นเดือนตุลาคม
    const stats = getDashboardStats(
      [makeRun({ createdAt: "2026-09-30T18:00:00.000Z" })],
      now,
    )

    expect(stats.analyzedThisMonth).toBe(1)
  })

  it("ไม่มีข้อมูลเดือนก่อน → เปอร์เซ็นต์และส่วนต่างเป็น null", () => {
    const stats = getDashboardStats([makeRun()], now)

    expect(stats.analyzedChangePercent).toBeNull()
    expect(stats.averageScoreChange).toBeNull()
  })

  it("JOB_MATCH และ COMBINED นับเป็น Job Match", () => {
    const stats = getDashboardStats(
      [
        makeRun({ analysisType: "JOB_MATCH" }),
        makeRun({ analysisType: "COMBINED" }),
        makeRun({ analysisType: "BASE" }),
      ],
      now,
    )

    expect(stats.jobMatchCount).toBe(2)
  })

  it("รายการว่าง → ไม่มีคะแนนเฉลี่ย", () => {
    expect(getDashboardStats([], now).averageScore).toBeNull()
  })
})

describe("getTopSkills", () => {
  function jobMatch(matchedSkills: string[]) {
    return makeRun({
      analysisType: "JOB_MATCH",
      jobMatch: { score: 70, matchedSkills, missingSkills: [], keywordMatches: [] },
    })
  }

  it("นับ skill ซ้ำในงานเดียวครั้งเดียว ไม่สนตัวพิมพ์ และเรียงตามจำนวน", () => {
    const skills = getTopSkills([
      jobMatch(["React", "react", " SQL "]),
      jobMatch(["React", "Docker"]),
    ])

    expect(skills).toEqual([
      { skill: "React", count: 2, ratio: 1 },
      { skill: "Docker", count: 1, ratio: 0.5 },
      { skill: "SQL", count: 1, ratio: 0.5 },
    ])
  })

  it("จำกัดจำนวนตาม limit และข้ามงานที่ไม่ใช่ Job Match", () => {
    const skills = getTopSkills(
      [jobMatch(["A", "B", "C"]), makeRun()],
      2,
    )

    expect(skills.map((entry) => entry.skill)).toEqual(["A", "B"])
  })
})
