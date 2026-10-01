import type { RowDataPacket } from "mysql2";

import type { UserRole } from "../auth/auth.types.js";

export type AdminAnalysisStatusFilter =
  | "ALL"
  | "ACTIVE"
  | "STUCK"
  | "COMPLETED"
  | "FAILED";

/*
 * ผู้กระทำ — ใช้บันทึก audit log
 */
export interface AdminActor {
  id: number;
  email: string;
  ip: string | null;
}

export interface AdminAuditLogRow extends RowDataPacket {
  id: number;
  admin_id: number | null;
  admin_email: string;
  action: string;
  target_type: string | null;
  target_id: number | null;
  details: Record<string, unknown> | null;
  ip_address: string | null;
  created_at: Date;
}

export interface AdminTrendDay {
  date: string;
  total: number;
  completed: number;
  failed: number;
  successRate: number | null;
  avgDurationSeconds: number | null;
}

export interface AdminOverview {
  users: {
    total: number;
    new7d: number;
  };
  resumes: {
    total: number;
  };
  analyses: {
    total: number;
    today: number;
    byStatus: Record<string, number>;
    // % ของงานที่จบแล้ว (COMPLETED / (COMPLETED + FAILED))
    successRate: number | null;
    avgDurationSeconds: number | null;
    // ค้างเกิน env.admin.stuckMinutes
    stuck: number;
    stuckMinutes: number;
  };
}

export interface AdminUserRow extends RowDataPacket {
  id: number;
  first_name: string;
  last_name: string;
  email: string;
  role: UserRole;
  created_at: Date;
  last_login_at: Date | null;
  resume_count: number;
  analysis_count: number;
}

export interface AdminAnalysisRow extends RowDataPacket {
  id: number;
  analysis_type: string;
  status: string;
  base_resume_score: number | null;
  job_match_score: number | null;
  attempt_count: number;
  error_code: string | null;
  error_message: string | null;
  model: string | null;
  created_at: Date;
  started_at: Date | null;
  completed_at: Date | null;
  failed_at: Date | null;
  last_progress_at: Date;
  user_id: number;
  user_email: string;
  resume_name: string | null;
  job_title: string | null;
}

export type ServiceStatus = {
  name: string;
  ok: boolean;
  latencyMs: number | null;
  detail: string;
};
