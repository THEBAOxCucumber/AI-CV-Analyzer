import type {
  ResumeAnalysisScores,
} from "../types/analysis"

/*
 * ตรงกับ BASE_RESUME_SCORE_LIMITS
 * ใน backend/src/modules/analysis/resume-analysis-rubric.ts
 */
const SECTION_META: Array<{
  key: keyof ResumeAnalysisScores
  labelTh: string
  labelEn: string
  maxScore: number
  description: string
}> = [
  {
    key: "contactInformation",
    labelTh: "ข้อมูลติดต่อ",
    labelEn: "Contact Information",
    maxScore: 10,
    description:
      "ชื่อ อีเมล เบอร์โทร และลิงก์ต่างๆ ครบและถูกต้อง",
  },
  {
    key: "professionalSummary",
    labelTh: "สรุปโปรไฟล์",
    labelEn: "Professional Summary",
    maxScore: 15,
    description:
      "ย่อหน้าแนะนำตัวบอกจุดเด่นและเป้าหมายได้ชัดเจน",
  },
  {
    key: "skills",
    labelTh: "ทักษะ",
    labelEn: "Skills",
    maxScore: 20,
    description:
      "ระบุทักษะที่เกี่ยวข้องกับงานครบและจัดกลุ่มชัดเจน",
  },
  {
    key: "experience",
    labelTh: "ประสบการณ์",
    labelEn: "Experience",
    maxScore: 25,
    description:
      "อธิบายงานที่ทำและผลลัพธ์เป็นรูปธรรม",
  },
  {
    key: "projects",
    labelTh: "โปรเจกต์",
    labelEn: "Projects",
    maxScore: 10,
    description:
      "มีผลงานที่แสดงความสามารถได้จริง",
  },
  {
    key: "education",
    labelTh: "การศึกษา",
    labelEn: "Education",
    maxScore: 10,
    description:
      "ข้อมูลการศึกษาครบถ้วนและเกี่ยวข้องกับงาน",
  },
  {
    key: "readability",
    labelTh: "ความอ่านง่าย",
    labelEn: "Readability",
    maxScore: 10,
    description:
      "จัดรูปแบบเป็นระเบียบ อ่านง่าย ความยาวเหมาะสม",
  },
]

export type ScoreLevel =
  | "good"
  | "fair"
  | "low"

export const SCORE_LEVEL_LABEL: Record<ScoreLevel, string> = {
  good: "ดีมาก",
  fair: "พอใช้",
  low: "ควรปรับปรุง",
}

export function getScoreLevel(
  percent: number,
): ScoreLevel {
  if (percent >= 80) {
    return "good"
  }

  if (percent >= 60) {
    return "fair"
  }

  return "low"
}

export interface SectionScore {
  key: keyof ResumeAnalysisScores
  labelTh: string
  labelEn: string
  description: string
  score: number
  maxScore: number

  /*
   * % ของคะแนนเต็มหมวดนั้น (0–100)
   * คะแนนเต็มแต่ละหมวดไม่เท่ากัน
   * จึงเทียบกันด้วย % ไม่ใช่คะแนนดิบ
   */
  percent: number
  level: ScoreLevel
}

export function buildSectionScores(
  scores: ResumeAnalysisScores | null,
): SectionScore[] {
  if (!scores) {
    return []
  }

  return SECTION_META.map((meta) => {
    const score = scores[meta.key]

    const percent = Math.round(
      Math.min(
        100,
        Math.max(
          0,
          (score / meta.maxScore) * 100,
        ),
      ),
    )

    return {
      ...meta,
      score,
      percent,
      level: getScoreLevel(percent),
    }
  })
}
