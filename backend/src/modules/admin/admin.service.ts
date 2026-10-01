import { database } from "../../config/database.js";
import { env } from "../../config/env.js";
import { qdrant } from "../../config/qdrant.js";
import { redisConnection } from "../../config/redis.js";
import { AppError } from "../../errors/app-error.js";
import { clearLoginRateLimit } from "../../middleware/rate-limit.middleware.js";
import type { UserRole } from "../auth/auth.types.js";
import { resumeAnalysisQueue } from "../analysis/resume-analysis.queue.js";
import { startAnalysisRun } from "../analysis/resume-analysis-run.service.js";
import type { ResumeAnalysisRunRecord } from "../analysis/resume-analysis-run.types.js";
import {
  findRunForRetry,
  findRunStatus,
  findUserBrief,
  findUserBriefByEmail,
  getDailyAnalysisStats,
  getOverviewCounts,
  insertAuditLog,
  listAnalyses,
  listAuditLogs,
  listUsers,
  markStuckRunCancelled,
  updateUserRole,
} from "./admin.repository.js";
import type {
  AdminActor,
  AdminAnalysisStatusFilter,
  AdminOverview,
  AdminTrendDay,
  ServiceStatus,
} from "./admin.types.js";

const HEALTH_TIMEOUT_MS = 3_000;
const BANGKOK_OFFSET_MS = 7 * 60 * 60_000;

/*
 * เที่ยงคืนวันนี้ตามเวลาไทย (DB เก็บ UTC)
 */
function getBangkokDayStart(now = new Date()): Date {
  const bangkok = new Date(now.getTime() + BANGKOK_OFFSET_MS);

  bangkok.setUTCHours(0, 0, 0, 0);

  return new Date(bangkok.getTime() - BANGKOK_OFFSET_MS);
}

function getStuckCutoff(): Date {
  return new Date(Date.now() - env.admin.stuckMinutes * 60_000);
}

export async function getOverview(): Promise<AdminOverview> {
  const todayStart = getBangkokDayStart();
  const weekStart = new Date(Date.now() - 7 * 24 * 60 * 60_000);

  return getOverviewCounts(
    todayStart,
    weekStart,
    getStuckCutoff(),
    env.admin.stuckMinutes,
  );
}

function withTimeout<T>(
  promise: Promise<T>,
  ms: number,
): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;

  const timeout = new Promise<never>((_resolve, reject) => {
    timer = setTimeout(
      () => reject(new Error(`timeout ${ms}ms`)),
      ms,
    );
  });

  return Promise.race([promise, timeout]).finally(() => {
    clearTimeout(timer);
  });
}

/*
 * วัดเวลา + จับ error → ServiceStatus เสมอ (ไม่ throw)
 */
async function probe(
  name: string,
  check: () => Promise<string>,
): Promise<ServiceStatus> {
  const startedAt = performance.now();

  try {
    const detail = await withTimeout(check(), HEALTH_TIMEOUT_MS);

    return {
      name,
      ok: true,
      latencyMs: Math.round(performance.now() - startedAt),
      detail,
    };
  } catch (error) {
    return {
      name,
      ok: false,
      latencyMs: null,
      detail: error instanceof Error ? error.message : String(error),
    };
  }
}

async function checkOllama(): Promise<string> {
  const response = await fetch(`${env.ollama.host}/api/tags`, {
    signal: AbortSignal.timeout(HEALTH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }

  const body = (await response.json()) as {
    models?: Array<{ name: string }>;
  };

  const hasModel = (body.models ?? []).some(
    (model) => model.name === env.ollama.model,
  );

  if (!hasModel) {
    throw new Error(`ไม่พบโมเดล ${env.ollama.model}`);
  }

  return env.ollama.model;
}

export async function getSystemStatus(): Promise<{
  services: ServiceStatus[];
  queue: Record<string, number> | null;
  checkedAt: string;
}> {
  const services = await Promise.all([
    probe("MySQL", async () => {
      await database.query("SELECT 1");
      return "connected";
    }),
    probe("Redis", async () => redisConnection.ping()),
    probe("Qdrant", async () => {
      const { collections } = await qdrant.getCollections();
      return `${collections.length} collections`;
    }),
    probe("Ollama", checkOllama),
  ]);

  let queue: Record<string, number> | null = null;

  try {
    queue = await withTimeout(
      resumeAnalysisQueue.getJobCounts(
        "waiting",
        "active",
        "delayed",
        "failed",
        "completed",
      ),
      HEALTH_TIMEOUT_MS,
    );
  } catch {
    // Redis ล่ม → แสดงว่าอ่านคิวไม่ได้
    queue = null;
  }

  return {
    services,
    queue,
    checkedAt: new Date().toISOString(),
  };
}

export async function getUsers(
  search: string,
  page: number,
  pageSize: number,
) {
  const { rows, total } = await listUsers(
    search,
    pageSize,
    (page - 1) * pageSize,
  );

  return {
    total,
    page,
    pageSize,
    users: rows.map((row) => ({
      id: row.id,
      firstName: row.first_name,
      lastName: row.last_name,
      email: row.email,
      role: row.role,
      createdAt: row.created_at,
      lastLoginAt: row.last_login_at,
      resumeCount: Number(row.resume_count),
      analysisCount: Number(row.analysis_count),
    })),
  };
}

function getDurationSeconds(
  startedAt: Date | null,
  endedAt: Date | null,
): number | null {
  if (!startedAt || !endedAt) {
    return null;
  }

  return Math.round((endedAt.getTime() - startedAt.getTime()) / 1000);
}

export async function getAnalyses(
  status: AdminAnalysisStatusFilter,
  page: number,
  pageSize: number,
) {
  const stuckCutoff = getStuckCutoff();

  const { rows, total } = await listAnalyses(
    status,
    stuckCutoff,
    pageSize,
    (page - 1) * pageSize,
  );

  return {
    total,
    page,
    pageSize,
    stuckMinutes: env.admin.stuckMinutes,
    analyses: rows.map((row) => {
      const isActive = ["PENDING", "QUEUED", "PROCESSING"].includes(row.status);

      return {
        id: row.id,
        analysisType: row.analysis_type,
        status: row.status,
        isStuck: isActive && row.last_progress_at < stuckCutoff,
        score: row.job_match_score ?? row.base_resume_score,
        attemptCount: row.attempt_count,
        errorCode: row.error_code,
        errorMessage: row.error_message,
        model: row.model,
        createdAt: row.created_at,
        lastProgressAt: row.last_progress_at,
        durationSeconds: getDurationSeconds(
          row.started_at,
          row.completed_at ?? row.failed_at,
        ),
        user: {
          id: row.user_id,
          email: row.user_email,
        },
        resumeName: row.resume_name,
        jobTitle: row.job_title,
      };
    }),
  };
}

/*
 * Audit log — บันทึกลง DB (+ console)
 * บันทึกไม่สำเร็จไม่ทำให้ action ล้ม (action เกิดขึ้นแล้ว)
 */
async function audit(
  actor: AdminActor,
  action: string,
  target: { type: string; id: number } | null,
  details: Record<string, unknown> = {},
): Promise<void> {
  console.info("[admin-audit]", {
    adminId: actor.id,
    action,
    target,
    ...details,
  });

  try {
    await insertAuditLog(actor, action, target, details);
  } catch (error) {
    console.error(
      "Failed to write admin audit log:",
      error instanceof Error ? error.message : error,
    );
  }
}

export async function getAuditLogs(
  page: number,
  pageSize: number,
) {
  const { rows, total } = await listAuditLogs(
    pageSize,
    (page - 1) * pageSize,
  );

  return {
    total,
    page,
    pageSize,
    logs: rows.map((row) => ({
      id: row.id,
      adminId: row.admin_id,
      adminEmail: row.admin_email,
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      details: row.details,
      ipAddress: row.ip_address,
      createdAt: row.created_at,
    })),
  };
}

/*
 * แนวโน้มรายวัน (เวลาไทย) — เติมวันที่ไม่มีงานเป็น 0
 */
export async function getTrends(
  days: number,
): Promise<{ days: number; series: AdminTrendDay[] }> {
  const todayStart = getBangkokDayStart();
  const fromUtc = new Date(todayStart.getTime() - (days - 1) * 24 * 60 * 60_000);

  const rows = await getDailyAnalysisStats(fromUtc);
  const byDay = new Map(rows.map((row) => [row.day, row]));

  const series: AdminTrendDay[] = [];

  for (let i = 0; i < days; i++) {
    // วันที่ตามเวลาไทยของจุดนี้
    const bangkokDate = new Date(fromUtc.getTime() + i * 24 * 60 * 60_000 + BANGKOK_OFFSET_MS);
    const date = bangkokDate.toISOString().slice(0, 10);
    const row = byDay.get(date);

    const completed = Number(row?.completed ?? 0);
    const failed = Number(row?.failed ?? 0);
    const finished = completed + failed;

    series.push({
      date,
      total: Number(row?.total ?? 0),
      completed,
      failed,
      successRate:
        finished === 0 ? null : Math.round((completed / finished) * 1000) / 10,
      avgDurationSeconds:
        row?.avg_seconds === null || row?.avg_seconds === undefined
          ? null
          : Math.round(Number(row.avg_seconds)),
    });
  }

  return { days, series };
}

export async function retryFailedAnalysis(
  actor: AdminActor,
  runId: number,
): Promise<ResumeAnalysisRunRecord> {
  const run = await findRunForRetry(runId);

  if (!run) {
    throw new AppError("ไม่พบ Analysis", 404, "ANALYSIS_RUN_NOT_FOUND");
  }

  if (run.status !== "FAILED") {
    throw new AppError(
      "ลองใหม่ได้เฉพาะ Analysis ที่ล้มเหลว",
      409,
      "ANALYSIS_NOT_FAILED",
    );
  }

  // สร้าง run ใหม่ในนามเจ้าของ (ผ่าน flow เดิม: ตรวจ resume/JD/คิวซ้ำ/rate limit)
  const newRun = await startAnalysisRun({
    resumeId: run.resume_id,
    userId: run.user_id,
    analysisType: run.analysis_type,
    jobDescriptionId: run.job_description_id ?? undefined,
  });

  await audit(actor, "RETRY_ANALYSIS", { type: "analysis", id: runId }, {
    newRunId: newRun.id,
    ownerId: run.user_id,
  });

  return newRun;
}

/*
 * ยกเลิกงานที่ค้างเกิน env.admin.stuckMinutes → FAILED แล้วลองใหม่ได้
 */
export async function cancelStuckAnalysis(
  actor: AdminActor,
  runId: number,
): Promise<{ id: number; status: "FAILED"; removedQueueJob: boolean }> {
  const cancelled = await markStuckRunCancelled(runId, getStuckCutoff());

  if (!cancelled) {
    const status = await findRunStatus(runId);

    if (status === null) {
      throw new AppError("ไม่พบ Analysis", 404, "ANALYSIS_RUN_NOT_FOUND");
    }

    throw new AppError(
      `ยกเลิกได้เฉพาะงานที่ค้างเกิน ${env.admin.stuckMinutes} นาที (สถานะตอนนี้: ${status})`,
      409,
      "ANALYSIS_NOT_STUCK",
    );
  }

  // ลบ job ที่ยังรอในคิว (ถ้ามี) — job ที่ worker ถืออยู่ลบไม่ได้ ข้ามไป
  let removedQueueJob = false;

  try {
    const job = await resumeAnalysisQueue.getJob(`analysis-${runId}`);

    if (job && !(await job.isActive())) {
      await job.remove();
      removedQueueJob = true;
    }
  } catch (error) {
    console.warn(
      "Could not remove queue job for cancelled analysis:",
      error instanceof Error ? error.message : error,
    );
  }

  await audit(actor, "CANCEL_STUCK_ANALYSIS", { type: "analysis", id: runId }, {
    removedQueueJob,
  });

  return { id: runId, status: "FAILED", removedQueueJob };
}

export async function unlockUserLogin(
  actor: AdminActor,
  userId: number,
): Promise<{ clearedKeys: number }> {
  const user = await findUserBrief(userId);

  if (!user) {
    throw new AppError("ไม่พบผู้ใช้", 404, "USER_NOT_FOUND");
  }

  const clearedKeys = await clearLoginRateLimit(user.email);

  await audit(actor, "UNLOCK_LOGIN", { type: "user", id: userId }, {
    email: user.email,
    clearedKeys,
  });

  return { clearedKeys };
}

/*
 * ตั้ง admin ด้วยอีเมล (บัญชีต้องสมัครไว้แล้ว)
 */
export async function promoteAdminByEmail(
  actor: AdminActor,
  email: string,
): Promise<{ id: number; email: string; role: UserRole; alreadyAdmin: boolean }> {
  const user = await findUserBriefByEmail(email);

  if (!user) {
    throw new AppError(
      "ไม่พบบัญชีที่ใช้อีเมลนี้ (ต้องสมัครสมาชิกก่อน)",
      404,
      "USER_NOT_FOUND",
    );
  }

  const alreadyAdmin = user.role === "ADMIN";

  if (!alreadyAdmin) {
    await updateUserRole(user.id, "ADMIN");
  }

  await audit(actor, "PROMOTE_ADMIN_BY_EMAIL", { type: "user", id: user.id }, {
    email: user.email,
    alreadyAdmin,
  });

  return {
    id: user.id,
    email: user.email,
    role: "ADMIN",
    alreadyAdmin,
  };
}

export async function changeUserRole(
  actor: AdminActor,
  userId: number,
  role: UserRole,
): Promise<{ id: number; role: UserRole }> {
  // กันระบบไม่เหลือ admin / ล็อกตัวเองออก
  if (actor.id === userId) {
    throw new AppError(
      "เปลี่ยน role ของตัวเองไม่ได้",
      400,
      "CANNOT_CHANGE_OWN_ROLE",
    );
  }

  const user = await findUserBrief(userId);

  if (!user) {
    throw new AppError("ไม่พบผู้ใช้", 404, "USER_NOT_FOUND");
  }

  if (user.role !== role) {
    await updateUserRole(userId, role);
  }

  await audit(actor, "CHANGE_ROLE", { type: "user", id: userId }, {
    email: user.email,
    from: user.role,
    to: role,
  });

  return { id: userId, role };
}
