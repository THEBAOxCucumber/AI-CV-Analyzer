import type {
  ResumeAnalysisRun,
} from "../types/analysis"

import {
  getThaiMonthKey,
} from "./date-time"

export type ScoreTone =
  | "good"
  | "fair"
  | "low"

export function getScoreTone(
  score: number,
): ScoreTone {
  if (score >= 80) {
    return "good"
  }

  if (score >= 60) {
    return "fair"
  }

  return "low"
}

function getPreviousMonthKey(
  monthKey: string,
): string {
  const [year, month] =
    monthKey.split("-").map(Number)

  return month === 1
    ? `${year - 1}-12`
    : `${year}-${String(month - 1).padStart(2, "0")}`
}

function average(
  values: number[],
): number | null {
  if (values.length === 0) {
    return null
  }

  return Math.round(
    values.reduce(
      (sum, value) => sum + value,
      0,
    ) / values.length,
  )
}

function getBaseScores(
  analyses: ResumeAnalysisRun[],
): number[] {
  return analyses
    .map((analysis) => analysis.baseResumeScore)
    .filter(
      (score): score is number =>
        score !== null,
    )
}

/*
 * JOB_MATCH และ COMBINED
 * นับเป็น Job Match
 */
function isJobMatchAnalysis(
  analysis: ResumeAnalysisRun,
): boolean {
  return analysis.analysisType !== "BASE"
}

export interface DashboardStats {
  analyzedCount: number
  analyzedThisMonth: number

  /*
   * null = เดือนก่อนไม่มีข้อมูล
   * เทียบเป็น % ไม่ได้
   */
  analyzedChangePercent: number | null

  averageScore: number | null

  /*
   * null = เดือนนี้หรือเดือนก่อน
   * ไม่มีคะแนน
   */
  averageScoreChange: number | null

  jobMatchCount: number
  jobMatchesThisMonth: number
}

export function getDashboardStats(
  analyses: ResumeAnalysisRun[],
  now: Date = new Date(),
): DashboardStats {
  const completed =
    analyses.filter(
      (analysis) =>
        analysis.status === "COMPLETED",
    )

  const thisMonthKey =
    getThaiMonthKey(now)

  const lastMonthKey =
    getPreviousMonthKey(thisMonthKey)

  const thisMonth =
    completed.filter(
      (analysis) =>
        getThaiMonthKey(analysis.createdAt) ===
        thisMonthKey,
    )

  const lastMonth =
    completed.filter(
      (analysis) =>
        getThaiMonthKey(analysis.createdAt) ===
        lastMonthKey,
    )

  const averageThisMonth =
    average(getBaseScores(thisMonth))

  const averageLastMonth =
    average(getBaseScores(lastMonth))

  return {
    analyzedCount:
      completed.length,

    analyzedThisMonth:
      thisMonth.length,

    analyzedChangePercent:
      lastMonth.length > 0
        ? Math.round(
          ((thisMonth.length - lastMonth.length) /
            lastMonth.length) *
          100,
        )
        : null,

    averageScore:
      average(getBaseScores(completed)),

    averageScoreChange:
      averageThisMonth !== null &&
        averageLastMonth !== null
        ? averageThisMonth - averageLastMonth
        : null,

    jobMatchCount:
      completed.filter(isJobMatchAnalysis)
        .length,

    jobMatchesThisMonth:
      thisMonth.filter(isJobMatchAnalysis)
        .length,
  }
}

export interface SkillFrequency {
  skill: string
  count: number

  /*
   * สัดส่วนของ Job Match
   * ที่ skill นี้ตรงกับงาน (0–1)
   */
  ratio: number
}

export function getTopSkills(
  analyses: ResumeAnalysisRun[],
  limit = 5,
): SkillFrequency[] {
  const jobMatches =
    analyses.filter(
      (analysis) =>
        analysis.status === "COMPLETED" &&
        analysis.jobMatch !== null,
    )

  const counts =
    new Map<
      string,
      {
        skill: string
        count: number
      }
    >()

  for (const analysis of jobMatches) {
    /*
     * นับ skill ซ้ำใน analysis เดียว
     * เพียงครั้งเดียว (ไม่สนตัวพิมพ์)
     */
    const seen = new Set<string>()

    for (const rawSkill of analysis.jobMatch?.matchedSkills ?? []) {
      const skill = rawSkill.trim()
      const key = skill.toLowerCase()

      if (!skill || seen.has(key)) {
        continue
      }

      seen.add(key)

      const entry = counts.get(key)

      if (entry) {
        entry.count += 1
      } else {
        counts.set(key, {
          skill,
          count: 1,
        })
      }
    }
  }

  return [...counts.values()]
    .sort(
      (a, b) =>
        b.count - a.count ||
        a.skill.localeCompare(b.skill),
    )
    .slice(0, limit)
    .map((entry) => ({
      ...entry,
      ratio:
        entry.count / jobMatches.length,
    }))
}
