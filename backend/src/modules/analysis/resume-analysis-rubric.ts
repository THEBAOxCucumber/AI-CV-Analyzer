export const BASE_RESUME_SCORE_LIMITS = {
  contactInformation: 10,
  professionalSummary: 15,
  skills: 20,
  experience: 25,
  projects: 10,
  education: 10,
  readability: 10,
} as const;

export const BASE_RESUME_MAX_SCORE = 100;

const totalMaximumScore =
  Object.values(
    BASE_RESUME_SCORE_LIMITS,
  ).reduce(
    (sum, score) => sum + score,
    0,
  );

if (
  totalMaximumScore !==
  BASE_RESUME_MAX_SCORE
) {
  throw new Error(
    "Base resume analysis rubric must total 100 points",
  );
}