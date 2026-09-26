import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร")
  .max(72, "รหัสผ่านต้องไม่เกิน 72 ตัวอักษร")
  .regex(/[A-Z]/, "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวใหญ่")
  .regex(/[a-z]/, "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวเล็ก")
  .regex(/[0-9]/, "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว");

export const registerSchema = z.object({
  firstName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกชื่อ")
    .max(100, "ชื่อต้องไม่เกิน 100 ตัวอักษร"),

  lastName: z
    .string()
    .trim()
    .min(1, "กรุณากรอกนามสกุล")
    .max(100, "นามสกุลต้องไม่เกิน 100 ตัวอักษร"),

  email: z
    .string()
    .trim()
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .max(255, "อีเมลต้องไม่เกิน 255 ตัวอักษร")
    .transform((value) => value.toLowerCase()),

  password: passwordSchema,
});

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .email("รูปแบบอีเมลไม่ถูกต้อง")
    .transform((value) => value.toLowerCase()),

  password: z
    .string()
    .min(1, "กรุณากรอกรหัสผ่าน"),
});

export const changePasswordSchema = z
  .object({
    currentPassword: z
      .string()
      .min(1, "กรุณากรอกรหัสผ่านปัจจุบัน"),

    newPassword: passwordSchema,
  })
  .refine(
    (data) =>
      data.newPassword !== data.currentPassword,
    {
      path: ["newPassword"],
      message:
        "รหัสผ่านใหม่ต้องไม่ซ้ำกับรหัสผ่านปัจจุบัน",
    },
  );

const emailSchema = z
  .string()
  .trim()
  .email("รูปแบบอีเมลไม่ถูกต้อง")
  .transform((value) => value.toLowerCase());

export const forgotPasswordSchema = z.object({
  email: emailSchema,
});

export const resetPasswordSchema = z.object({
  email: emailSchema,

  otp: z
    .string()
    .trim()
    .regex(/^\d{6}$/, "รหัส OTP ต้องเป็นตัวเลข 6 หลัก"),

  newPassword: passwordSchema,
});

export type RegisterBody = z.infer<typeof registerSchema>;
export type ForgotPasswordBody = z.infer<typeof forgotPasswordSchema>;
export type ResetPasswordBody = z.infer<typeof resetPasswordSchema>;
export type LoginBody = z.infer<typeof loginSchema>;
export type ChangePasswordBody = z.infer<typeof changePasswordSchema>;