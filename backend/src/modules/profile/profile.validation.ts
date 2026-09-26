import { z } from "zod";

export const educationLevelSchema = z.enum([
  "HIGH_SCHOOL",
  "VOCATIONAL",
  "BACHELOR",
  "MASTER",
  "DOCTORATE",
]);

export const experienceLevelSchema = z.enum([
  "FRESH_GRADUATE",
  "JUNIOR",
  "MID_LEVEL",
  "SENIOR",
]);

const currentYear = new Date().getFullYear();

export const updateProfileSchema = z.object({
  phone: z
    .string()
    .trim()
    .regex(
      /^0[0-9]{8,9}$/,
      "เบอร์โทรศัพท์ต้องขึ้นต้นด้วย 0 และมี 9–10 หลัก",
    )
    .nullable(),

  location: z
    .string()
    .trim()
    .max(255, "ที่อยู่ต้องไม่เกิน 255 ตัวอักษร")
    .nullable(),

  headline: z
    .string()
    .trim()
    .max(255, "Headline ต้องไม่เกิน 255 ตัวอักษร")
    .nullable(),

  university: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อมหาวิทยาลัย")
    .max(255, "ชื่อมหาวิทยาลัยต้องไม่เกิน 255 ตัวอักษร")
    .nullable(),

  faculty: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อคณะ")
    .max(255, "ชื่อคณะต้องไม่เกิน 255 ตัวอักษร")
    .nullable(),

  major: z
    .string()
    .trim()
    .min(1, "กรุณากรอกสาขาวิชา")
    .max(255, "สาขาวิชาต้องไม่เกิน 255 ตัวอักษร")
    .nullable(),

  educationLevel: educationLevelSchema.nullable(),

  graduationYear: z
    .number({
      error: "ปีที่จบการศึกษาต้องเป็นตัวเลข",
    })
    .int("ปีที่จบการศึกษาต้องเป็นจำนวนเต็ม")
    .min(1950, "ปีที่จบการศึกษาไม่ถูกต้อง")
    .max(
      currentYear + 10,
      "ปีที่จบการศึกษาต้องไม่เกิน 10 ปีข้างหน้า",
    )
    .nullable(),

  interestedPosition: z
    .string()
    .trim()
    .min(1, "กรุณากรอกตำแหน่งงานที่สนใจ")
    .max(255, "ตำแหน่งงานต้องไม่เกิน 255 ตัวอักษร")
    .nullable(),

  experienceLevel: experienceLevelSchema.nullable(),

  bio: z
    .string()
    .trim()
    .max(2000, "ข้อมูลแนะนำตัวต้องไม่เกิน 2,000 ตัวอักษร")
    .nullable(),
});

export type UpdateProfileBody = z.infer<
  typeof updateProfileSchema
>;