import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { database } from "../../config/database.js";

export interface PasswordResetOtpRow extends RowDataPacket {
  id: number;
  user_id: number;
  code_hash: string;
  attempt_count: number;
  consumed_at: Date | null;

  /*
   * คำนวณด้วย NOW() ของ MySQL
   * ไม่ต้องเทียบเวลาข้าม timezone ใน Node
   */
  is_expired: 0 | 1;
  seconds_since_created: number;
}

export async function findLatestOtpByUserId(
  userId: number,
): Promise<PasswordResetOtpRow | null> {
  const [rows] =
    await database.execute<PasswordResetOtpRow[]>(
      `
        SELECT
          id,
          user_id,
          code_hash,
          attempt_count,
          consumed_at,
          expires_at <= NOW() AS is_expired,
          TIMESTAMPDIFF(
            SECOND,
            created_at,
            NOW()
          ) AS seconds_since_created
        FROM password_reset_otps
        WHERE user_id = ?
        ORDER BY id DESC
        LIMIT 1
      `,
      [userId],
    );

  return rows[0] ?? null;
}

/*
 * OTP ใหม่ทำให้ OTP เก่าใช้ไม่ได้
 */
export async function replaceOtp(
  userId: number,
  codeHash: string,
  ttlMinutes: number,
): Promise<void> {
  const connection =
    await database.getConnection();

  try {
    await connection.beginTransaction();

    await connection.execute<ResultSetHeader>(
      `
        UPDATE password_reset_otps
        SET consumed_at = NOW()
        WHERE user_id = ?
          AND consumed_at IS NULL
      `,
      [userId],
    );

    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO password_reset_otps (
          user_id,
          code_hash,
          expires_at
        )
        VALUES (
          ?,
          ?,
          DATE_ADD(NOW(), INTERVAL ? MINUTE)
        )
      `,
      [userId, codeHash, ttlMinutes],
    );

    await connection.commit();
  } catch (error) {
    await connection.rollback();

    throw error;
  } finally {
    connection.release();
  }
}

export async function incrementOtpAttempt(
  otpId: number,
): Promise<void> {
  await database.execute<ResultSetHeader>(
    `
      UPDATE password_reset_otps
      SET attempt_count = attempt_count + 1
      WHERE id = ?
        AND consumed_at IS NULL
    `,
    [otpId],
  );
}

/*
 * false = ถูกใช้ไปแล้ว
 * (กัน request ซ้อนใช้ OTP เดียวกัน)
 */
export async function consumeOtp(
  otpId: number,
  connection?: PoolConnection,
): Promise<boolean> {
  const executor = connection ?? database;

  const [result] =
    await executor.execute<ResultSetHeader>(
      `
        UPDATE password_reset_otps
        SET consumed_at = NOW()
        WHERE id = ?
          AND consumed_at IS NULL
      `,
      [otpId],
    );

  return result.affectedRows === 1;
}
