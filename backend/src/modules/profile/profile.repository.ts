import type { ResultSetHeader } from "mysql2";

import { database } from "../../config/database.js";
import type {
  UpdateProfileInput,
  UserProfile,
  UserProfileRow,
} from "./profile.types.js";

/**
 * ค้นหา Profile จาก user_id
 */
export async function findProfileByUserId(
  userId: number,
): Promise<UserProfileRow | null> {
  const [rows] = await database.execute<UserProfileRow[]>(
    `
      SELECT
        id,
        user_id,
        phone,
        university,
        faculty,
        major,
        education_level,
        graduation_year,
        interested_position,
        experience_level,
        bio,
        created_at,
        updated_at
      FROM user_profiles
      WHERE user_id = ?
      LIMIT 1
    `,
    [userId],
  );

  return rows[0] ?? null;
}

/**
 * สร้าง Profile ใหม่
 */
export async function createProfile(
  userId: number,
  input: UpdateProfileInput,
): Promise<UserProfile> {
  const [result] = await database.execute<ResultSetHeader>(
    `
      INSERT INTO user_profiles (
        user_id,
        phone,
        university,
        faculty,
        major,
        education_level,
        graduation_year,
        interested_position,
        experience_level,
        bio
      )
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    `,
    [
      userId,
      input.phone,
      input.university,
      input.faculty,
      input.major,
      input.educationLevel,
      input.graduationYear,
      input.interestedPosition,
      input.experienceLevel,
      input.bio,
    ],
  );

  return {
    id: result.insertId,
    userId,
    phone: input.phone,
    university: input.university,
    faculty: input.faculty,
    major: input.major,
    educationLevel: input.educationLevel,
    graduationYear: input.graduationYear,
    interestedPosition: input.interestedPosition,
    experienceLevel: input.experienceLevel,
    bio: input.bio,
  };
}

/**
 * แก้ไข Profile เดิม
 */
export async function updateProfile(
  userId: number,
  input: UpdateProfileInput,
): Promise<UserProfile | null> {
  const [result] = await database.execute<ResultSetHeader>(
    `
      UPDATE user_profiles
      SET
        phone = ?,
        university = ?,
        faculty = ?,
        major = ?,
        education_level = ?,
        graduation_year = ?,
        interested_position = ?,
        experience_level = ?,
        bio = ?
      WHERE user_id = ?
    `,
    [
      input.phone,
      input.university,
      input.faculty,
      input.major,
      input.educationLevel,
      input.graduationYear,
      input.interestedPosition,
      input.experienceLevel,
      input.bio,
      userId,
    ],
  );

  if (result.affectedRows === 0) {
    return null;
  }

  return {
    userId,
    phone: input.phone,
    university: input.university,
    faculty: input.faculty,
    major: input.major,
    educationLevel: input.educationLevel,
    graduationYear: input.graduationYear,
    interestedPosition: input.interestedPosition,
    experienceLevel: input.experienceLevel,
    bio: input.bio,
  };
}