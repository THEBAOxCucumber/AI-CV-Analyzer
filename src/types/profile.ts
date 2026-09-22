export type EducationLevel =
  | "HIGH_SCHOOL"
  | "VOCATIONAL"
  | "BACHELOR"
  | "MASTER"
  | "DOCTORATE"

export type ExperienceLevel =
  | "FRESH_GRADUATE"
  | "JUNIOR"
  | "MID_LEVEL"
  | "SENIOR"

export interface UserProfile {
  id?: number
  userId: number
  phone: string | null
  university: string | null
  faculty: string | null
  major: string | null
  educationLevel: EducationLevel | null
  graduationYear: number | null
  interestedPosition: string | null
  experienceLevel: ExperienceLevel | null
  bio: string | null
}

export interface UpdateProfileInput {
  phone: string | null
  university: string | null
  faculty: string | null
  major: string | null
  educationLevel: EducationLevel | null
  graduationYear: number | null
  interestedPosition: string | null
  experienceLevel: ExperienceLevel | null
  bio: string | null
}