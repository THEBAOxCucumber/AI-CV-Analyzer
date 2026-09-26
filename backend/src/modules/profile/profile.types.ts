import type { RowDataPacket } from "mysql2";

export type EducationLevel =
  | "HIGH_SCHOOL"
  | "VOCATIONAL"
  | "BACHELOR"
  | "MASTER"
  | "DOCTORATE";

export type ExperienceLevel =
  | "FRESH_GRADUATE"
  | "JUNIOR"
  | "MID_LEVEL"
  | "SENIOR";

export interface UserProfileRow extends RowDataPacket {
  id: number;
  user_id: number;
  phone: string | null;
  location: string | null;
  headline: string | null;
  university: string | null;
  faculty: string | null;
  major: string | null;
  education_level: EducationLevel | null;
  graduation_year: number | null;
  interested_position: string | null;
  experience_level: ExperienceLevel | null;
  bio: string | null;
  created_at: Date;
  updated_at: Date;
}

export interface UpdateProfileInput {
  phone: string | null;
  location: string | null;
  headline: string | null;
  university: string | null;
  faculty: string | null;
  major: string | null;
  educationLevel: EducationLevel | null;
  graduationYear: number | null;
  interestedPosition: string | null;
  experienceLevel: ExperienceLevel | null;
  bio: string | null;
}

export interface UserProfile {
  id?: number;
  userId: number;
  phone: string | null;
  location: string | null;
  headline: string | null;
  university: string | null;
  faculty: string | null;
  major: string | null;
  educationLevel: EducationLevel | null;
  graduationYear: number | null;
  interestedPosition: string | null;
  experienceLevel: ExperienceLevel | null;
  bio: string | null;
}