import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";

import { database } from "../../config/database.js";
import type { OAuthProfile } from "./oauth.providers.js";

// ENUM ใน DB ยังมี 'LINKEDIN' (migration 017) แต่ระบบใช้แค่ Google
type ProviderDbName = "GOOGLE";

interface OAuthAccountRow extends RowDataPacket {
  user_id: number;
}

export async function findUserIdByOAuthAccount(
  provider: ProviderDbName,
  providerUserId: string,
): Promise<number | null> {
  const [rows] = await database.execute<OAuthAccountRow[]>(
    `
      SELECT user_id
      FROM user_oauth_accounts
      WHERE provider = ? AND provider_user_id = ?
      LIMIT 1
    `,
    [provider, providerUserId],
  );

  return rows[0]?.user_id ?? null;
}

interface UserIdRow extends RowDataPacket {
  id: number;
}

export async function findUserIdByEmail(
  email: string,
): Promise<number | null> {
  const [rows] = await database.execute<UserIdRow[]>(
    "SELECT id FROM users WHERE email = ? LIMIT 1",
    [email],
  );

  return rows[0]?.id ?? null;
}

export async function linkOAuthAccount(
  userId: number,
  provider: ProviderDbName,
  profile: OAuthProfile,
): Promise<void> {
  // ผู้ใช้เคยเชื่อม provider นี้ด้วยบัญชีอื่นแล้ว → แทนที่ด้วยบัญชีล่าสุด
  await database.execute(
    `
      INSERT INTO user_oauth_accounts (user_id, provider, provider_user_id, email, last_login_at)
      VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
      ON DUPLICATE KEY UPDATE
        provider_user_id = VALUES(provider_user_id),
        email = VALUES(email),
        last_login_at = UTC_TIMESTAMP()
    `,
    [userId, provider, profile.providerUserId, profile.email],
  );
}

export async function touchOAuthAccount(
  provider: ProviderDbName,
  providerUserId: string,
  email: string,
): Promise<void> {
  await database.execute(
    `
      UPDATE user_oauth_accounts
      SET last_login_at = UTC_TIMESTAMP(), email = ?
      WHERE provider = ? AND provider_user_id = ?
    `,
    [email, provider, providerUserId],
  );
}

/*
 * บัญชีใหม่จาก OAuth — password_hash สุ่ม (ไม่มีใครรู้) + password_set = 0
 * สร้างผู้ใช้กับการเชื่อมบัญชีใน transaction เดียว
 */
export async function createUserWithOAuthAccount(
  provider: ProviderDbName,
  profile: OAuthProfile,
  unusablePasswordHash: string,
): Promise<number> {
  const connection = await database.getConnection();

  try {
    await connection.beginTransaction();

    const [result] = await connection.execute<ResultSetHeader>(
      `
        INSERT INTO users (first_name, last_name, email, password_hash, password_set)
        VALUES (?, ?, ?, ?, 0)
      `,
      [profile.firstName, profile.lastName, profile.email, unusablePasswordHash],
    );

    await connection.execute(
      `
        INSERT INTO user_oauth_accounts (user_id, provider, provider_user_id, email, last_login_at)
        VALUES (?, ?, ?, ?, UTC_TIMESTAMP())
      `,
      [result.insertId, provider, profile.providerUserId, profile.email],
    );

    await connection.commit();

    return result.insertId;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}
