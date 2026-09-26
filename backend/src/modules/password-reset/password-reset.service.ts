import bcrypt from "bcrypt";
import {
  createHmac,
  randomInt,
  timingSafeEqual,
} from "node:crypto";

import { database } from "../../config/database.js";
import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";

import {
  findUserByEmail,
  updatePasswordHash,
} from "../auth/auth.repository.js";

import {
  isMailConfigured,
  sendMail,
} from "../mail/mail.service.js";

import {
  passwordChangedEmail,
  passwordResetOtpEmail,
} from "../mail/mail.templates.js";

import {
  consumeOtp,
  findLatestOtpByUserId,
  incrementOtpAttempt,
  replaceOtp,
} from "./password-reset.repository.js";

/*
 * เก็บ OTP เป็น HMAC ไม่ใช่เลขจริง
 * ผูกกับ userId กัน hash ซ้ำข้าม user
 */
function hashOtp(
  userId: number,
  otp: string,
): string {
  return createHmac("sha256", env.jwt.secret)
    .update(`${userId}:${otp}`)
    .digest("hex");
}

function generateOtp(): string {
  return randomInt(0, 1_000_000)
    .toString()
    .padStart(6, "0");
}

function invalidOtpError(): AppError {
  return new AppError(
    "รหัส OTP ไม่ถูกต้องหรือหมดอายุ กรุณาขอรหัสใหม่",
    400,
    "INVALID_OR_EXPIRED_OTP",
  );
}

function tooManyAttemptsError(): AppError {
  return new AppError(
    "กรอก OTP ผิดเกินจำนวนครั้งที่กำหนด กรุณาขอรหัสใหม่",
    400,
    "OTP_TOO_MANY_ATTEMPTS",
  );
}

/*
 * ไม่บอกว่าอีเมลมีบัญชีหรือไม่
 * (ไม่มีบัญชี / อยู่ใน cooldown → จบเงียบๆ)
 */
export async function requestPasswordReset(
  email: string,
): Promise<void> {
  /*
   * เช็กก่อนหา user
   * ทุกอีเมลได้ผลเหมือนกัน
   */
  if (!isMailConfigured()) {
    throw new AppError(
      "ระบบอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ",
      503,
      "EMAIL_NOT_CONFIGURED",
    );
  }

  const user = await findUserByEmail(email);

  if (!user) {
    return;
  }

  const latest =
    await findLatestOtpByUserId(user.id);

  if (
    latest &&
    latest.seconds_since_created <
      env.passwordReset.resendCooldownSeconds
  ) {
    return;
  }

  const otp = generateOtp();

  await replaceOtp(
    user.id,
    hashOtp(user.id, otp),
    env.passwordReset.otpTtlMinutes,
  );

  await sendMail(
    passwordResetOtpEmail({
      to: user.email,
      firstName: user.first_name,
      otp,
      ttlMinutes:
        env.passwordReset.otpTtlMinutes,
    }),
  );
}

export async function resetPasswordWithOtp(input: {
  email: string;
  otp: string;
  newPassword: string;
}): Promise<void> {
  const user =
    await findUserByEmail(input.email);

  if (!user) {
    throw invalidOtpError();
  }

  const otpRow =
    await findLatestOtpByUserId(user.id);

  if (
    !otpRow ||
    otpRow.consumed_at !== null ||
    Number(otpRow.is_expired) === 1
  ) {
    throw invalidOtpError();
  }

  const maxAttempts =
    env.passwordReset.maxAttempts;

  if (otpRow.attempt_count >= maxAttempts) {
    throw tooManyAttemptsError();
  }

  const matches = timingSafeEqual(
    Buffer.from(
      hashOtp(user.id, input.otp),
      "hex",
    ),
    Buffer.from(otpRow.code_hash, "hex"),
  );

  if (!matches) {
    await incrementOtpAttempt(otpRow.id);

    const remaining =
      maxAttempts - (otpRow.attempt_count + 1);

    if (remaining <= 0) {
      throw tooManyAttemptsError();
    }

    throw new AppError(
      `รหัส OTP ไม่ถูกต้อง (เหลืออีก ${remaining} ครั้ง)`,
      400,
      "INVALID_OTP",
    );
  }

  const passwordHash = await bcrypt.hash(
    input.newPassword,
    12,
  );

  /*
   * ใช้ OTP + เปลี่ยนรหัส
   * ใน transaction เดียว
   */
  const connection =
    await database.getConnection();

  try {
    await connection.beginTransaction();

    const consumed = await consumeOtp(
      otpRow.id,
      connection,
    );

    if (!consumed) {
      throw invalidOtpError();
    }

    await updatePasswordHash(
      user.id,
      passwordHash,
      connection,
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }

  await notifyPasswordChanged({
    email: user.email,
    firstName: user.first_name,
  });
}

/*
 * แจ้งเตือนแบบ best-effort
 * ส่งไม่ได้ไม่ทำให้การเปลี่ยนรหัสล้มเหลว
 * (sendMail log error ไว้แล้ว)
 */
export async function notifyPasswordChanged(user: {
  email: string;
  firstName: string;
}): Promise<void> {
  if (!isMailConfigured()) {
    return;
  }

  try {
    await sendMail(
      passwordChangedEmail({
        to: user.email,
        firstName: user.firstName,
        changedAt: new Date(),
      }),
    );
  } catch {
    // logged in sendMail
  }
}
