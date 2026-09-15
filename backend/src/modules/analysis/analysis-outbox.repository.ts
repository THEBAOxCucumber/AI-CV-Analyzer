import type {
  PoolConnection,
  ResultSetHeader,
  RowDataPacket,
} from "mysql2/promise";

import { database } from "../../config/database.js";

export const RESUME_ANALYSIS_REQUESTED_EVENT =
  "RESUME_ANALYSIS_REQUESTED";

interface AnalysisOutboxRow
  extends RowDataPacket {
  id: number;
  analysis_run_id: number;
  event_type: string;
  status: "PENDING" | "DISPATCHED";
  attempt_count: number;
  last_error: string | null;
  created_at: Date;
  dispatched_at: Date | null;
}

export interface AnalysisOutboxRecord {
  id: number;
  analysisRunId: number;
  eventType: string;
  status: "PENDING" | "DISPATCHED";
  attemptCount: number;
  lastError: string | null;
  createdAt: Date;
  dispatchedAt: Date | null;
}

function mapAnalysisOutbox(
  row: AnalysisOutboxRow,
): AnalysisOutboxRecord {
  return {
    id: row.id,
    analysisRunId:
      row.analysis_run_id,
    eventType: row.event_type,
    status: row.status,
    attemptCount:
      row.attempt_count,
    lastError: row.last_error,
    createdAt: row.created_at,
    dispatchedAt:
      row.dispatched_at,
  };
}

export async function createAnalysisOutboxEvent(
  analysisRunId: number,
  connection: PoolConnection,
): Promise<number> {
  const [result] =
    await connection.execute<ResultSetHeader>(
      `
        INSERT INTO analysis_outbox (
          analysis_run_id,
          event_type,
          status
        )
        VALUES (?, ?, 'PENDING')
      `,
      [
        analysisRunId,
        RESUME_ANALYSIS_REQUESTED_EVENT,
      ],
    );

  return result.insertId;
}

export async function findPendingAnalysisOutboxEvents(
  limit = 20,
): Promise<AnalysisOutboxRecord[]> {
  const safeLimit = Number.isFinite(limit)
    ? Math.min(
        100,
        Math.max(1, Math.floor(limit)),
      )
    : 20;

  const [rows] =
    await database.query<
      AnalysisOutboxRow[]
    >(
      `
        SELECT
          id,
          analysis_run_id,
          event_type,
          status,
          attempt_count,
          last_error,
          created_at,
          dispatched_at
        FROM analysis_outbox
        WHERE status = 'PENDING'
        ORDER BY created_at ASC, id ASC
        LIMIT ?
      `,
      [safeLimit],
    );

  return rows.map(
    mapAnalysisOutbox,
  );
}

export async function markAnalysisOutboxDispatched(
  outboxId: number,
): Promise<boolean> {
  const [result] =
    await database.execute<ResultSetHeader>(
      `
        UPDATE analysis_outbox
        SET
          status = 'DISPATCHED',
          dispatched_at = NOW(),
          last_error = NULL
        WHERE id = ?
          AND status = 'PENDING'
      `,
      [outboxId],
    );

  return result.affectedRows === 1;
}

export async function recordAnalysisOutboxFailure(
  outboxId: number,
  errorMessage: string,
): Promise<void> {
  await database.execute(
    `
      UPDATE analysis_outbox
      SET
        attempt_count =
          attempt_count + 1,
        last_error = ?
      WHERE id = ?
        AND status = 'PENDING'
    `,
    [
      errorMessage,
      outboxId,
    ],
  );
}