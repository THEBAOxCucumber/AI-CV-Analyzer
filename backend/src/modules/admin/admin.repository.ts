import type {
  ResultSetHeader,
  RowDataPacket,
} from "mysql2";

import { database } from "../../config/database.js";
import type { UserRole } from "../auth/auth.types.js";
import type {
  AdminActor,
  AdminAnalysisRow,
  AdminAnalysisStatusFilter,
  AdminAuditLogRow,
  AdminOverview,
  AdminUserRow,
} from "./admin.types.js";

/*
 * งานค้าง = ยังไม่จบ และไม่ขยับมานานเกิน cutoff
 * (PROCESSING นับจาก started_at, QUEUED จาก queued_at, PENDING จาก created_at)
 */
const ACTIVE_STATUSES_SQL =
  "a.status IN ('PENDING', 'QUEUED', 'PROCESSING')";

const STUCK_SQL =
  `${ACTIVE_STATUSES_SQL} AND COALESCE(a.started_at, a.queued_at, a.created_at) < ?`;

/*
 * Query สำหรับหน้า Admin (อ่านอย่างเดียว ยกเว้น updateUserRole)
 * ไม่ส่ง password_hash / extracted_text / ผลวิเคราะห์เต็มออกไป
 */

interface CountRow extends RowDataPacket {
  total: number;
}

async function count(
  sql: string,
  params: Array<string | number | Date> = [],
): Promise<number> {
  const [rows] =
    await database.execute<CountRow[]>(
      sql,
      params,
    );

  return Number(rows[0]?.total ?? 0);
}

interface StatusCountRow extends RowDataPacket {
  status: string;
  total: number;
}

interface DurationRow extends RowDataPacket {
  avg_seconds: number | null;
}

export async function getOverviewCounts(
  todayStart: Date,
  weekStart: Date,
  stuckCutoff: Date,
  stuckMinutes: number,
): Promise<AdminOverview> {
  const [
    totalUsers,
    newUsers7d,
    totalResumes,
    analysesToday,
    stuck,
  ] = await Promise.all([
    count("SELECT COUNT(*) AS total FROM users"),
    count(
      "SELECT COUNT(*) AS total FROM users WHERE created_at >= ?",
      [weekStart],
    ),
    count("SELECT COUNT(*) AS total FROM resumes"),
    count(
      "SELECT COUNT(*) AS total FROM resume_analysis_runs WHERE created_at >= ?",
      [todayStart],
    ),
    count(
      `SELECT COUNT(*) AS total FROM resume_analysis_runs a WHERE ${STUCK_SQL}`,
      [stuckCutoff],
    ),
  ]);

  const [statusRows] =
    await database.execute<StatusCountRow[]>(
      `
        SELECT status, COUNT(*) AS total
        FROM resume_analysis_runs
        GROUP BY status
      `,
    );

  const byStatus: Record<string, number> = {};

  for (const row of statusRows) {
    byStatus[row.status] = Number(row.total);
  }

  // เวลาเฉลี่ยของงานที่เสร็จใน 7 วัน (เริ่มทำ → เสร็จ)
  const [durationRows] =
    await database.execute<DurationRow[]>(
      `
        SELECT AVG(TIMESTAMPDIFF(SECOND, started_at, completed_at)) AS avg_seconds
        FROM resume_analysis_runs
        WHERE status = 'COMPLETED'
          AND started_at IS NOT NULL
          AND completed_at >= ?
      `,
      [weekStart],
    );

  const completed = byStatus.COMPLETED ?? 0;
  const failed = byStatus.FAILED ?? 0;
  const finished = completed + failed;

  const avgSeconds =
    durationRows[0]?.avg_seconds;

  return {
    users: {
      total: totalUsers,
      new7d: newUsers7d,
    },
    resumes: {
      total: totalResumes,
    },
    analyses: {
      total: Object.values(byStatus).reduce(
        (sum, value) => sum + value,
        0,
      ),
      today: analysesToday,
      byStatus,
      successRate:
        finished === 0
          ? null
          : Math.round((completed / finished) * 1000) / 10,
      avgDurationSeconds:
        avgSeconds === null ||
        avgSeconds === undefined
          ? null
          : Math.round(Number(avgSeconds)),
      stuck,
      stuckMinutes,
    },
  };
}

export async function listUsers(
  search: string,
  limit: number,
  offset: number,
): Promise<{
  rows: AdminUserRow[];
  total: number;
}> {
  const where = search
    ? "WHERE u.email LIKE ? OR CONCAT(u.first_name, ' ', u.last_name) LIKE ?"
    : "";

  const pattern = `%${search}%`;
  const searchParams = search
    ? [pattern, pattern]
    : [];

  const total = await count(
    `SELECT COUNT(*) AS total FROM users u ${where}`,
    searchParams,
  );

  // LIMIT/OFFSET เป็นตัวเลขที่ validate แล้ว (mysql2 execute ไม่รับ placeholder ใน LIMIT)
  const [rows] =
    await database.execute<AdminUserRow[]>(
      `
        SELECT
          u.id,
          u.first_name,
          u.last_name,
          u.email,
          u.role,
          u.created_at,
          u.last_login_at,
          (SELECT COUNT(*) FROM resumes r WHERE r.user_id = u.id) AS resume_count,
          (SELECT COUNT(*) FROM resume_analysis_runs a WHERE a.user_id = u.id) AS analysis_count
        FROM users u
        ${where}
        ORDER BY u.created_at DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `,
      searchParams,
    );

  return { rows, total };
}

function buildAnalysisFilter(
  status: AdminAnalysisStatusFilter,
  stuckCutoff: Date,
): {
  where: string;
  params: Array<string | Date>;
} {
  switch (status) {
    case "ALL":
      return { where: "", params: [] };
    case "ACTIVE":
      return { where: `WHERE ${ACTIVE_STATUSES_SQL}`, params: [] };
    case "STUCK":
      return { where: `WHERE ${STUCK_SQL}`, params: [stuckCutoff] };
    default:
      return { where: "WHERE a.status = ?", params: [status] };
  }
}

export async function listAnalyses(
  status: AdminAnalysisStatusFilter,
  stuckCutoff: Date,
  limit: number,
  offset: number,
): Promise<{
  rows: AdminAnalysisRow[];
  total: number;
}> {
  const { where, params } =
    buildAnalysisFilter(status, stuckCutoff);

  const total = await count(
    `SELECT COUNT(*) AS total FROM resume_analysis_runs a ${where}`,
    params,
  );

  const [rows] =
    await database.execute<AdminAnalysisRow[]>(
      `
        SELECT
          a.id,
          a.analysis_type,
          a.status,
          a.base_resume_score,
          a.job_match_score,
          a.attempt_count,
          a.error_code,
          a.error_message,
          a.model,
          a.created_at,
          a.started_at,
          a.completed_at,
          a.failed_at,
          COALESCE(a.started_at, a.queued_at, a.created_at) AS last_progress_at,
          u.id AS user_id,
          u.email AS user_email,
          r.original_name AS resume_name,
          j.title AS job_title
        FROM resume_analysis_runs a
        JOIN users u ON u.id = a.user_id
        LEFT JOIN resumes r ON r.id = a.resume_id
        LEFT JOIN job_descriptions j ON j.id = a.job_description_id
        ${where}
        ORDER BY a.created_at DESC, a.id DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `,
      params,
    );

  return { rows, total };
}

interface RunForRetryRow extends RowDataPacket {
  id: number;
  resume_id: number;
  user_id: number;
  job_description_id: number | null;
  analysis_type: "BASE" | "JOB_MATCH" | "COMBINED";
  status: string;
}

export async function findRunForRetry(
  runId: number,
): Promise<RunForRetryRow | null> {
  const [rows] =
    await database.execute<RunForRetryRow[]>(
      `
        SELECT id, resume_id, user_id, job_description_id, analysis_type, status
        FROM resume_analysis_runs
        WHERE id = ?
        LIMIT 1
      `,
      [runId],
    );

  return rows[0] ?? null;
}

interface UserBriefRow extends RowDataPacket {
  id: number;
  email: string;
  role: UserRole;
}

export async function findUserBrief(
  userId: number,
): Promise<UserBriefRow | null> {
  const [rows] =
    await database.execute<UserBriefRow[]>(
      "SELECT id, email, role FROM users WHERE id = ? LIMIT 1",
      [userId],
    );

  return rows[0] ?? null;
}

export async function findUserBriefByEmail(
  email: string,
): Promise<UserBriefRow | null> {
  const [rows] =
    await database.execute<UserBriefRow[]>(
      "SELECT id, email, role FROM users WHERE email = ? LIMIT 1",
      [email],
    );

  return rows[0] ?? null;
}

/*
 * ยกเลิกงานค้าง — เงื่อนไขอยู่ใน UPDATE เดียว (atomic)
 * ถ้า worker ขยับงานไปแล้วระหว่างนั้น จะไม่ทับ (affectedRows = 0)
 */
export async function markStuckRunCancelled(
  runId: number,
  stuckCutoff: Date,
): Promise<boolean> {
  const [result] =
    await database.execute<ResultSetHeader>(
      `
        UPDATE resume_analysis_runs a
        SET
          a.status = 'FAILED',
          a.error_code = 'CANCELLED_BY_ADMIN',
          a.error_message = 'ผู้ดูแลยกเลิกงานที่ค้างอยู่ในคิว กรุณาลองวิเคราะห์อีกครั้ง',
          a.failed_at = UTC_TIMESTAMP()
        WHERE a.id = ?
          AND ${STUCK_SQL}
      `,
      [runId, stuckCutoff],
    );

  return result.affectedRows > 0;
}

export async function findRunStatus(
  runId: number,
): Promise<string | null> {
  const [rows] =
    await database.execute<Array<RowDataPacket & { status: string }>>(
      "SELECT status FROM resume_analysis_runs WHERE id = ? LIMIT 1",
      [runId],
    );

  return rows[0]?.status ?? null;
}

/*
 * เหตุการณ์ที่ผู้ใช้ทำเอง (ไม่มี Admin) เช่น ลบบัญชี
 * admin_email ห้ามว่าง → ใส่ค่าคงที่ แทนการเก็บอีเมลของผู้ใช้ (PDPA: ขอลบแล้ว)
 */
export const SELF_SERVICE_ACTOR = "self-service";

export async function insertSelfServiceAuditLog(
  action: string,
  target: { type: string; id: number },
  details: Record<string, unknown>,
): Promise<void> {
  await database.execute(
    `
      INSERT INTO admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details, ip_address
      )
      VALUES (NULL, ?, ?, ?, ?, ?, NULL)
    `,
    [
      SELF_SERVICE_ACTOR,
      action,
      target.type,
      target.id,
      JSON.stringify(details),
    ],
  );
}

export async function insertAuditLog(
  actor: AdminActor,
  action: string,
  target: { type: string; id: number } | null,
  details: Record<string, unknown>,
): Promise<void> {
  await database.execute(
    `
      INSERT INTO admin_audit_logs (
        admin_id, admin_email, action, target_type, target_id, details, ip_address
      )
      VALUES (?, ?, ?, ?, ?, ?, ?)
    `,
    [
      actor.id,
      actor.email,
      action,
      target?.type ?? null,
      target?.id ?? null,
      JSON.stringify(details),
      actor.ip,
    ],
  );
}

export async function listAuditLogs(
  limit: number,
  offset: number,
): Promise<{
  rows: AdminAuditLogRow[];
  total: number;
}> {
  const total = await count(
    "SELECT COUNT(*) AS total FROM admin_audit_logs",
  );

  const [rows] =
    await database.execute<AdminAuditLogRow[]>(
      `
        SELECT id, admin_id, admin_email, action, target_type, target_id,
               details, ip_address, created_at
        FROM admin_audit_logs
        ORDER BY created_at DESC, id DESC
        LIMIT ${Number(limit)} OFFSET ${Number(offset)}
      `,
    );

  return { rows, total };
}

interface TrendRow extends RowDataPacket {
  day: string;
  total: number;
  completed: number;
  failed: number;
  avg_seconds: number | null;
}

/*
 * Analysis รายวันตามเวลาไทย (DB เก็บ UTC)
 * คืนเฉพาะวันที่มีข้อมูล — service เติมวันที่ว่างเป็น 0
 */
export async function getDailyAnalysisStats(
  fromUtc: Date,
): Promise<TrendRow[]> {
  const [rows] =
    await database.execute<TrendRow[]>(
      `
        SELECT
          DATE_FORMAT(CONVERT_TZ(created_at, '+00:00', '+07:00'), '%Y-%m-%d') AS day,
          COUNT(*) AS total,
          SUM(status = 'COMPLETED') AS completed,
          SUM(status = 'FAILED') AS failed,
          AVG(
            CASE
              WHEN status = 'COMPLETED' AND started_at IS NOT NULL AND completed_at IS NOT NULL
              THEN TIMESTAMPDIFF(SECOND, started_at, completed_at)
            END
          ) AS avg_seconds
        FROM resume_analysis_runs
        WHERE created_at >= ?
        GROUP BY day
        ORDER BY day
      `,
      [fromUtc],
    );

  return rows;
}

export async function updateUserRole(
  userId: number,
  role: UserRole,
): Promise<boolean> {
  const [result] =
    await database.execute<ResultSetHeader>(
      "UPDATE users SET role = ? WHERE id = ?",
      [role, userId],
    );

  return result.affectedRows > 0;
}
