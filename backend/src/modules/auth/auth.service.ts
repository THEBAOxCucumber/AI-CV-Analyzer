import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";
import { AppError } from "../../errors/app-error.js";
import { env } from "../../config/env.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
  updateLastLoginAt,
  updatePasswordHash,
} from "./auth.repository.js";
import type {
  ChangePasswordBody,
} from "./auth.validation.js";
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