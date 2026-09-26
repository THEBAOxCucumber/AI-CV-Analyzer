import type { ResultSetHeader } from "mysql2";
import type { PoolConnection } from "mysql2/promise";

import { database } from "../../config/database.js";
import type {
  PublicUser,
  RegisterInput,
  UserRow,
} from "./auth.types.js";

export async function findUserByEmail(
  email: string,
): Promise<UserRow | null> {
  const [rows] = await database.execute<UserRow[]>(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        password_hash,
        role,
        last_login_at,
        created_at,
        updated_at
      FROM users
      WHERE email = ?
      LIMIT 1
    `,
    [email],
  );

  return rows[0] ?? null;
}

export async function createUser(
  input: RegisterInput,
  passwordHash: string,
): Promise<PublicUser> {
  const [result] = await database.execute<ResultSetHeader>(
    `
      INSERT INTO users (
        first_name,
        last_name,
        email,
        password_hash
      )
      VALUES (?, ?, ?, ?)
    `,
    [
      input.firstName,
      input.lastName,
      input.email,
      passwordHash,
    ],
  );

  return {
    id: result.insertId,
    firstName: input.firstName,
    lastName: input.lastName,
    email: input.email,
    role: "USER",
    createdAt: new Date(),
    lastLoginAt: null,
  };
}

export async function updatePasswordHash(
  userId: number,
  passwordHash: string,
  connection?: PoolConnection,
): Promise<void> {
  const executor = connection ?? database;

  await executor.execute<ResultSetHeader>(
    `
      UPDATE users
      SET password_hash = ?
      WHERE id = ?
    `,
    [passwordHash, userId],
  );
}

/**
 * บันทึกเวลา login ล่าสุด
 * คง updated_at เดิม (ไม่นับเป็นการแก้ข้อมูลบัญชี)
 */
export async function updateLastLoginAt(
  userId: number,
): Promise<Date> {
  const loggedInAt = new Date();

  await database.execute<ResultSetHeader>(
    `
      UPDATE users
      SET
        last_login_at = ?,
        updated_at = updated_at
      WHERE id = ?
    `,
    [loggedInAt, userId],
  );

  return loggedInAt;
}

export async function findUserById(
  id: number,
): Promise<UserRow | null> {
  const [rows] = await database.execute<UserRow[]>(
    `
      SELECT
        id,
        first_name,
        last_name,
        email,
        password_hash,
        role,
        last_login_at,
        created_at,
        updated_at
      FROM users
      WHERE id = ?
      LIMIT 1
    `,
    [id],
  );

  return rows[0] ?? null;
}