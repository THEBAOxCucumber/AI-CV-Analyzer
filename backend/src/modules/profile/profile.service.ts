import {
  createProfile,
  findProfileByUserId,
  updateProfile,
} from "./profile.repository.js";

import type {
  UpdateProfileInput,
  UserProfile,
  UserProfileRow,
} from "./profile.types.js";

import { AppError } from "../../errors/app-error.js";

function mapProfile(row: UserProfileRow): UserProfile {
  return {
    id: row.id,
    userId: row.user_id,
    phone: row.phone,
    university: row.university,
    faculty: row.faculty,
    major: row.major,
    educationLevel: row.education_level,
    graduationYear: row.graduation_year,
    interestedPosition: row.interested_position,
    experienceLevel: row.experience_level,
    bio: row.bio,
  };
}

export async function getProfile(
  userId: number,
): Promise<UserProfile> {
  const profile = await findProfileByUserId(userId);

  if (!profile) {
    throw new AppError(
      "ยังไม่มีข้อมูลโปรไฟล์",
      404,
      "PROFILE_NOT_FOUND",
    );
  }

  return mapProfile(profile);
}
export async function saveProfile(
  userId: number,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const existingProfile = await findProfileByUserId(userId);

  if (!existingProfile) {
    return createProfile(userId, input);
  }

  const updatedProfile = await updateProfile(userId, input);

  if (!updatedProfile) {
  throw new AppError(
    "ไม่สามารถอัปเดตโปรไฟล์ได้",
    500,
    "PROFILE_UPDATE_FAILED",
  );
}

  return updatedProfile;
}