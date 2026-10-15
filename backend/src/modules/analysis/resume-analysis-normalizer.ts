interface AnalysisScores {
  contactInformation: number;
  professionalSummary: number;
  skills: number;
  experience: number;
  projects: number;
  education: number;
  readability: number;
}

interface JobMatchLike {
  score: number;
}

interface AnalysisResultLike {
  baseResumeScore?: unknown;
  jobMatchScore?: unknown;
  scores?: unknown;
  jobMatch?: unknown;
  [key: string]: unknown;
}

function isAnalysisScores(
  value: unknown,
): value is AnalysisScores {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.contactInformation ===
      "number" &&
    typeof candidate.professionalSummary ===
      "number" &&
    typeof candidate.skills === "number" &&
    typeof candidate.experience === "number" &&
    typeof candidate.projects === "number" &&
    typeof candidate.education === "number" &&
    typeof candidate.readability === "number"
  );
}

function isJobMatchLike(
  value: unknown,
): value is JobMatchLike {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return false;
  }

  const candidate =
    value as Record<string, unknown>;

  return (
    typeof candidate.score === "number"
  );
}

const SKILL_LIST_KEYS = [
  "matchedSkills",
  "missingSkills",
  "keywordMatches",
] as const;

function skillKey(skill: string): string {
  return skill.trim().toLowerCase();
}

/*
 * ตัดช่องว่าง / ค่าว่าง / ซ้ำ (ไม่สนตัวพิมพ์) — คงลำดับเดิม
 */
function cleanSkillList(value: unknown): unknown {
  if (!Array.isArray(value)) {
    return value;
  }

  const seen = new Set<string>();

  return value.filter((item): item is string => {
    if (typeof item !== "string") {
      return true;
    }

    const key = skillKey(item);

    if (!key || seen.has(key)) {
      return false;
    }

    seen.add(key);
    return true;
  }).map((item) =>
    typeof item === "string" ? item.trim() : item,
  );
}

function escapeRegExp(text: string): string {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/*
 * ทักษะปรากฏใน Resume ไหม (ไม่สนตัวพิมพ์, ต้องไม่ติดกับตัวอักษร/ตัวเลขอื่น)
 * "Java" ไม่นับว่าเจอใน "JavaScript", แต่ "Node.js" / "CI/CD" / "C++" หาได้
 */
export function resumeMentionsSkill(
  resumeText: string,
  skill: string,
): boolean {
  const pattern = new RegExp(
    `(?<![\\p{L}\\p{N}])${escapeRegExp(skill.trim())}(?![\\p{L}\\p{N}])`,
    "iu",
  );

  return pattern.test(resumeText);
}

/*
 * AI บางครั้งใส่ทักษะเดียวกันทั้งใน "ยังขาด" และ "ตรง/คีย์เวิร์ด"
 * ตัดสินด้วยข้อความ Resume จริง:
 *   เจอใน Resume → ไม่ได้ขาด (ลบจาก missingSkills)
 *   ไม่เจอ       → อ้างว่าตรงไม่ได้ (ลบจาก matchedSkills + keywordMatches)
 * ไม่มีข้อความ Resume → ถือว่าไม่เจอ (ไม่อ้างสิ่งที่ตรวจสอบไม่ได้)
 */
function resolveSkillConflicts(
  jobMatch: Record<string, unknown>,
  resumeText: string | undefined,
): void {
  for (const key of SKILL_LIST_KEYS) {
    jobMatch[key] = cleanSkillList(jobMatch[key]);
  }

  const { matchedSkills, missingSkills, keywordMatches } = jobMatch;

  if (
    !Array.isArray(missingSkills) ||
    (!Array.isArray(matchedSkills) && !Array.isArray(keywordMatches))
  ) {
    return;
  }

  const presentKeys = new Set(
    [
      ...(Array.isArray(matchedSkills) ? matchedSkills : []),
      ...(Array.isArray(keywordMatches) ? keywordMatches : []),
    ]
      .filter((item): item is string => typeof item === "string")
      .map(skillKey),
  );

  const conflicts = missingSkills.filter(
    (item): item is string =>
      typeof item === "string" && presentKeys.has(skillKey(item)),
  );

  if (conflicts.length === 0) {
    return;
  }

  const inResume = new Set<string>();
  const notInResume = new Set<string>();

  for (const skill of conflicts) {
    if (resumeText && resumeMentionsSkill(resumeText, skill)) {
      inResume.add(skillKey(skill));
    } else {
      notInResume.add(skillKey(skill));
    }
  }

  const without = (list: unknown, keys: Set<string>) =>
    Array.isArray(list)
      ? list.filter((item) => typeof item !== "string" || !keys.has(skillKey(item)))
      : list;

  jobMatch.missingSkills = without(missingSkills, inResume);
  jobMatch.matchedSkills = without(matchedSkills, notInResume);
  jobMatch.keywordMatches = without(keywordMatches, notInResume);
}

export function normalizeResumeAnalysisResult(
  value: unknown,
  options: {
    /** ข้อความ Resume (รวม chunks) ใช้ตัดสินทักษะที่ AI ใส่ขัดกัน */
    resumeText?: string;
  } = {},
): unknown {
  if (
    typeof value !== "object" ||
    value === null
  ) {
    return value;
  }

  const result: AnalysisResultLike = {
    ...(value as Record<string, unknown>),
  };

  if (isAnalysisScores(result.scores)) {
    result.baseResumeScore =
      Object.values(
        result.scores,
      ).reduce(
        (sum, score) => sum + score,
        0,
      );
  }

  if (result.jobMatch === null) {
    result.jobMatchScore = null;
  } else if (
    isJobMatchLike(result.jobMatch)
  ) {
    result.jobMatchScore =
      result.jobMatch.score;

    // คัดลอกก่อนแก้ — ไม่แก้ object ที่ส่งเข้ามา
    const jobMatch = {
      ...(result.jobMatch as unknown as Record<string, unknown>),
    };

    resolveSkillConflicts(jobMatch, options.resumeText);

    result.jobMatch = jobMatch;
  }

  return result;
}