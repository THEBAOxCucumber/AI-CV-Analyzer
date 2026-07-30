export const RESUME_ANALYSIS_SCORE_LIMITS = {
  contactInformation: 10,
  professionalSummary: 10,
  skills: 15,
  experience: 20,
  projects: 20,
  education: 10,
  readability: 10,
  jobRelevance: 5,
} as const;

export const RESUME_ANALYSIS_MAX_SCORE = 100;

export const RESUME_ANALYSIS_PROMPT_VERSION =
  "resume-analysis-v1";

  const totalMaximumScore = Object.values(
  RESUME_ANALYSIS_SCORE_LIMITS,
).reduce((sum, score) => sum + score, 0);

if (
  totalMaximumScore !==
  RESUME_ANALYSIS_MAX_SCORE
) {
  throw new Error(
    "Resume analysis rubric must total 100 points",
  );
}