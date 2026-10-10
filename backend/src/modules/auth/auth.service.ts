import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AppError } from "../../errors/app-error.js";
import { env } from "../../config/env.js";
import {
  countAdmins,
  countAnalysesByUserId,
  createUser,
  deleteUserById,
  findUserByEmail,
  findUserById,
  updateLastLoginAt,
  updatePasswordHash,
} from "./auth.repository.js";
import type {
  ChangePasswordBody,
  DeleteAccountBody,
} from "./auth.validation.js";
import {
  findResumesByUserId,
} from "../resume/resume.repository.js";
import {
  removeResumeFile,
} from "../resume/resume.service.js";
import {
  deleteUserVectors,
} from "../embedding/vector-store.service.js";
import {
  insertSelfServiceAuditLog,
} from "../admin/admin.repository.js";
import {
  notifyPasswordChanged,
} from "../password-reset/password-reset.service.js";
import type {
  LoginInput,
  PublicUser,
  RegisterInput,
  UserRow,
} from "./auth.types.js";

interface AuthResult {
  user: PublicUser;
  token: string;
}

function toPublicUser(row: UserRow): PublicUser {
  return {
    id: row.id,
    firstName: row.first_name,
    lastName: row.last_name,
    email: row.email,
    role: row.role,
    createdAt: row.created_at,
    lastLoginAt: row.last_login_at,
    needsPassword: Number(row.password_set) === 0,
  };
}

function createToken(user: PublicUser): string {
  const options: SignOptions = {
  algorithm: "HS256",
  expiresIn:
    env.jwt.expiresIn as SignOptions["expiresIn"],
};

  return jwt.sign(
    {
      sub: user.id.toString(),
      email: user.email,
      role: user.role,
    },
    env.jwt.secret,
    options,
  );
}

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export async function register(
  input: RegisterInput,
): Promise<AuthResult> {
  const normalizedInput: RegisterInput = {
    firstName: input.firstName.trim(),
    lastName: input.lastName.trim(),
    email: normalizeEmail(input.email),
    password: input.password,
  };

  if (
    !normalizedInput.firstName ||
    !normalizedInput.lastName ||
    !normalizedInput.email ||
    !normalizedInput.password
  ) {
    throw new Error("กรุณากรอกข้อมูลให้ครบถ้วน");
  }

  if (normalizedInput.password.length < 8) {
    throw new Error("รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร");
  }

  const existingUser = await findUserByEmail(normalizedInput.email);

  if (existingUser) {
    throw new AppError(
  "อีเมลนี้ถูกใช้งานแล้ว",
  409,
  "EMAIL_ALREADY_EXISTS",
);
  }

  const passwordHash = await bcrypt.hash(
    normalizedInput.password,
    12,
  );

  const user = await createUser(normalizedInput, passwordHash);
  const token = createToken(user);

  return { user, token };
}

export async function login(
  input: LoginInput,
): Promise<AuthResult> {
  const email = normalizeEmail(input.email);

  if (!email || !input.password) {
    throw new Error("กรุณากรอกอีเมลและรหัสผ่าน");
  }

  const userRow = await findUserByEmail(email);

  if (!userRow) {
  throw new AppError(
    "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    401,
    "INVALID_CREDENTIALS",
  );
}

  const passwordMatches = await bcrypt.compare(
    input.password,
    userRow.password_hash,
  );

  if (!passwordMatches) {
  throw new AppError(
    "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
    401,
    "INVALID_CREDENTIALS",
  );
}

  const lastLoginAt =
    await updateLastLoginAt(userRow.id);

  const user: PublicUser = {
    ...toPublicUser(userRow),
    lastLoginAt,
  };

  const token = createToken(user);

  return { user, token };
}

/*
 * ออก JWT ให้ผู้ใช้ที่ยืนยันตัวตนแล้วด้วยวิธีอื่น (Google)
 */
export async function issueAuthResultForUser(
  userId: number,
): Promise<AuthResult> {
  const userRow = await findUserById(userId);

  if (!userRow) {
    throw new AppError(
      "ไม่พบบัญชีผู้ใช้",
      404,
      "USER_NOT_FOUND",
    );
  }

  const lastLoginAt =
    await updateLastLoginAt(userRow.id);

  const user: PublicUser = {
    ...toPublicUser(userRow),
    lastLoginAt,
  };

  return {
    user,
    token: createToken(user),
  };
}

/*
 * ตั้งรหัสผ่านครั้งแรก (บัญชีที่สร้างผ่าน OAuth) — ไม่ต้องใช้รหัสเดิม
 * บัญชีที่มีรหัสผ่านแล้วต้องใช้ changePassword
 */
export async function setInitialPassword(
  userId: number,
  newPassword: string,
): Promise<PublicUser> {
  const userRow = await findUserById(userId);

  if (!userRow) {
    throw new AppError(
      "ไม่พบบัญชีผู้ใช้",
      404,
      "USER_NOT_FOUND",
    );
  }

  if (Number(userRow.password_set) !== 0) {
    throw new AppError(
      "บัญชีนี้ตั้งรหัสผ่านแล้ว กรุณาใช้เมนูเปลี่ยนรหัสผ่าน",
      409,
      "PASSWORD_ALREADY_SET",
    );
  }

  const passwordHash = await bcrypt.hash(
    newPassword,
    12,
  );

  // updatePasswordHash ตั้ง password_set = 1 ด้วย
  await updatePasswordHash(
    userId,
    passwordHash,
  );

  return {
    ...toPublicUser(userRow),
    needsPassword: false,
  };
}

export async function getCurrentUser(
  userId: number,
): Promise<PublicUser> {
  const userRow = await findUserById(userId);

  if (!userRow) {
  throw new AppError(
    "ไม่พบบัญชีผู้ใช้",
    404,
    "USER_NOT_FOUND",
  );
}
  return toPublicUser(userRow);
}

export async function changePassword(
  userId: number,
  input: ChangePasswordBody,
): Promise<void> {
  const userRow = await findUserById(userId);

  if (!userRow) {
    throw new AppError(
      "ไม่พบบัญชีผู้ใช้",
      404,
      "USER_NOT_FOUND",
    );
  }

  const currentPasswordMatches =
    await bcrypt.compare(
      input.currentPassword,
      userRow.password_hash,
    );

  /*
   * 400 ไม่ใช่ 401
   * frontend จะได้ไม่มองว่า session หมดอายุ
   */
  if (!currentPasswordMatches) {
    throw new AppError(
      "รหัสผ่านปัจจุบันไม่ถูกต้อง",
      400,
      "INVALID_CURRENT_PASSWORD",
    );
  }

  const passwordHash = await bcrypt.hash(
    input.newPassword,
    12,
  );

  await updatePasswordHash(
    userId,
    passwordHash,
  );

  await notifyPasswordChanged({
    email: userRow.email,
    firstName: userRow.first_name,
  });
}

/*
 * ลบบัญชีถาวร (PDPA: ผู้ใช้ขอลบข้อมูลตัวเองได้)
 *
 * ลำดับ: ตรวจสิทธิ์ → ลบ vector (ล้ม = ยังไม่ลบอะไร ลองใหม่ได้)
 *       → ลบ user (DB cascade ข้อมูลทั้งหมด) → ลบไฟล์ PDF
 */
export async function deleteAccount(
  userId: number,
  input: DeleteAccountBody,
): Promise<void> {
  const userRow = await findUserById(userId);

  if (!userRow) {
    throw new AppError(
      "ไม่พบบัญชีผู้ใช้",
      404,
      "USER_NOT_FOUND",
    );
  }

  if (input.confirmEmail !== normalizeEmail(userRow.email)) {
    throw new AppError(
      "อีเมลที่พิมพ์ไม่ตรงกับอีเมลของบัญชี",
      400,
      "CONFIRM_EMAIL_MISMATCH",
    );
  }

  const passwordMatches =
    await bcrypt.compare(
      input.currentPassword,
      userRow.password_hash,
    );

  // 400 ไม่ใช่ 401 (เหตุผลเดียวกับ changePassword)
  if (!passwordMatches) {
    throw new AppError(
      "รหัสผ่านปัจจุบันไม่ถูกต้อง",
      400,
      "INVALID_CURRENT_PASSWORD",
    );
  }

  if (
    userRow.role === "ADMIN" &&
    await countAdmins() <= 1
  ) {
    throw new AppError(
      "คุณเป็น Admin คนสุดท้าย กรุณาตั้ง Admin คนอื่นก่อนลบบัญชี",
      409,
      "LAST_ADMIN",
    );
  }

  // เก็บ path / จำนวนไว้ก่อน — หลังลบ user แถวลูกจะหายไปด้วย
  const resumes = await findResumesByUserId(userId);
  const analysisCount = await countAnalysesByUserId(userId);

  await deleteUserVectors(userId);

  await deleteUserById(userId);

  await Promise.all(
    resumes.map((resume) =>
      removeResumeFile(resume.file_path),
    ),
  );

  await recordAccountDeletion(userRow, resumes.length, analysisCount);
}

/*
 * บันทึกให้ Admin เห็นว่ามีการลบบัญชี
 * ไม่เก็บอีเมล / ชื่อ / IP (ผู้ใช้ขอลบข้อมูลแล้ว) — เก็บแค่ id และตัวเลขสรุป
 * บันทึกไม่สำเร็จ ≠ ลบไม่สำเร็จ (ข้อมูลลบไปแล้ว) → log ไว้ ไม่ throw
 */
async function recordAccountDeletion(
  userRow: UserRow,
  resumeCount: number,
  analysisCount: number,
): Promise<void> {
  const accountAgeDays = Math.max(
    0,
    Math.floor(
      (Date.now() - new Date(userRow.created_at).getTime()) /
        (24 * 60 * 60 * 1000),
    ),
  );

  try {
    await insertSelfServiceAuditLog(
      "ACCOUNT_SELF_DELETED",
      { type: "user", id: userRow.id },
      {
        role: userRow.role,
        resumes: resumeCount,
        analyses: analysisCount,
        accountAgeDays,
      },
    );
  } catch (error) {
    console.error(
      "Failed to write account deletion audit log:",
      error instanceof Error ? error.message : error,
    );
  }
}