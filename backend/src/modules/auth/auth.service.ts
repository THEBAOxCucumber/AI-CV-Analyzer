import bcrypt from "bcrypt";
import jwt, { type SignOptions } from "jsonwebtoken";

import { env } from "../../config/env.js";
import {
  createUser,
  findUserByEmail,
  findUserById,
} from "./auth.repository.js";
import type {
  LoginInput,
  PublicUser,
  RegisterInput,
} from "./auth.types.js";

interface AuthResult {
  user: PublicUser;
  token: string;
}

function createToken(user: PublicUser): string {
  const options: SignOptions = {
    expiresIn: env.jwt.expiresIn as SignOptions["expiresIn"],
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
    throw new Error("อีเมลนี้ถูกใช้งานแล้ว");
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
    throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }

  const passwordMatches = await bcrypt.compare(
    input.password,
    userRow.password_hash,
  );

  if (!passwordMatches) {
    throw new Error("อีเมลหรือรหัสผ่านไม่ถูกต้อง");
  }

  const user: PublicUser = {
    id: userRow.id,
    firstName: userRow.first_name,
    lastName: userRow.last_name,
    email: userRow.email,
    role: userRow.role,
  };

  const token = createToken(user);

  return { user, token };
}

export async function getCurrentUser(
  userId: number,
): Promise<PublicUser> {
  const userRow = await findUserById(userId);

  if (!userRow) {
    throw new Error("ไม่พบบัญชีผู้ใช้");
  }

  return {
    id: userRow.id,
    firstName: userRow.first_name,
    lastName: userRow.last_name,
    email: userRow.email,
    role: userRow.role,
  };
}