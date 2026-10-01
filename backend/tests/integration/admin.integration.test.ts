import request from "supertest";
import {
  afterAll,
  beforeAll,
  describe,
  expect,
  it,
} from "vitest";

import { app } from "../../src/app.js";
import { database } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";

const PASSWORD = "TestPassword123!";
const createdEmails: string[] = [];

function uniqueIp(): string {
  const part = () => Math.floor(Math.random() * 250) + 1;
  return `10.${part()}.${part()}.${part()}`;
}

async function registerUser(prefix: string): Promise<{
  id: number;
  email: string;
  token: string;
}> {
  const email = `${prefix}-${Date.now()}-${Math.random()}@test.local`;

  const register = await request(app)
    .post("/api/auth/register")
    .send({ firstName: "Admin", lastName: "Test", email, password: PASSWORD });

  expect(register.status).toBe(201);
  createdEmails.push(email);

  const login = await request(app)
    .post("/api/auth/login")
    .set("X-Forwarded-For", uniqueIp())
    .send({ email, password: PASSWORD });

  expect(login.status).toBe(200);

  return {
    id: login.body.data.user.id,
    email,
    token: login.body.data.token,
  };
}

let admin: Awaited<ReturnType<typeof registerUser>>;
let user: Awaited<ReturnType<typeof registerUser>>;

beforeAll(async () => {
  admin = await registerUser("admin");
  user = await registerUser("admin-target");

  await database.execute("UPDATE users SET role = 'ADMIN' WHERE id = ?", [admin.id]);
});

afterAll(async () => {
  for (const email of createdEmails) {
    await database.execute("DELETE FROM users WHERE email = ?", [email]);
  }
});

const asAdmin = (req: request.Test) => req.set("Authorization", `Bearer ${admin.token}`);
const asUser = (req: request.Test) => req.set("Authorization", `Bearer ${user.token}`);

describe("admin access control", () => {
  it("rejects requests without a token", async () => {
    const response = await request(app).get("/api/admin/overview");
    expect(response.status).toBe(401);
  });

  it("rejects non-admin users", async () => {
    for (const path of ["/overview", "/status", "/users", "/analyses"]) {
      const response = await asUser(request(app).get(`/api/admin${path}`));
      expect(response.status).toBe(403);
    }
  });
});

describe("admin read endpoints", () => {
  it("returns overview counts", async () => {
    const response = await asAdmin(request(app).get("/api/admin/overview"));

    expect(response.status).toBe(200);
    expect(response.body.data.users.total).toBeGreaterThanOrEqual(2);
    expect(response.body.data.analyses).toHaveProperty("byStatus");
  });

  it("returns service status without throwing when a service is down", async () => {
    const response = await asAdmin(request(app).get("/api/admin/status"));

    expect(response.status).toBe(200);
    expect(response.body.data.services.map((s: { name: string }) => s.name)).toEqual([
      "MySQL",
      "Redis",
      "Qdrant",
      "Ollama",
    ]);
    expect(response.body.data.services[0].ok).toBe(true);
  });

  it("searches users without exposing password hashes", async () => {
    const response = await asAdmin(
      request(app).get("/api/admin/users").query({ search: user.email }),
    );

    expect(response.status).toBe(200);
    expect(response.body.data.total).toBe(1);
    expect(response.body.data.users[0].email).toBe(user.email);
    expect(JSON.stringify(response.body)).not.toContain("password");
  });

  it("validates query parameters", async () => {
    const response = await asAdmin(
      request(app).get("/api/admin/analyses").query({ status: "BOGUS" }),
    );

    expect(response.status).toBe(400);
  });

  it("lists analyses", async () => {
    const response = await asAdmin(
      request(app).get("/api/admin/analyses").query({ status: "FAILED", pageSize: 5 }),
    );

    expect(response.status).toBe(200);
    expect(Array.isArray(response.body.data.analyses)).toBe(true);
  });
});

describe("admin actions", () => {
  it("cannot change its own role", async () => {
    const response = await asAdmin(
      request(app).patch(`/api/admin/users/${admin.id}/role`).send({ role: "USER" }),
    );

    expect(response.status).toBe(400);
    expect(response.body.code).toBe("CANNOT_CHANGE_OWN_ROLE");
  });

  it("promotes and demotes another user (takes effect immediately)", async () => {
    const promote = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}/role`).send({ role: "ADMIN" }),
    );

    expect(promote.status).toBe(200);

    const nowAdmin = await asUser(request(app).get("/api/admin/overview"));
    expect(nowAdmin.status).toBe(200);

    const demote = await asAdmin(
      request(app).patch(`/api/admin/users/${user.id}/role`).send({ role: "USER" }),
    );

    expect(demote.status).toBe(200);

    const notAdmin = await asUser(request(app).get("/api/admin/overview"));
    expect(notAdmin.status).toBe(403);
  });

  it("unlocks a user blocked by the login rate limit", async () => {
    const ip = uniqueIp();
    const login = (password: string) =>
      request(app)
        .post("/api/auth/login")
        .set("X-Forwarded-For", ip)
        .send({ email: user.email, password });

    for (let i = 0; i < env.rateLimit.loginMaxFailures; i++) {
      await login("WrongPassword123!");
    }

    expect((await login(PASSWORD)).status).toBe(429);

    const unlock = await asAdmin(
      request(app).post(`/api/admin/users/${user.id}/unlock-login`),
    );

    expect(unlock.status).toBe(200);
    expect(unlock.body.data.clearedKeys).toBeGreaterThanOrEqual(1);
    expect((await login(PASSWORD)).status).toBe(200);
  });

  it("promotes an existing user to admin by email (case-insensitive)", async () => {
    const target = await registerUser("admin-by-email");

    const forbidden = await asUser(
      request(app).post("/api/admin/admins").send({ email: target.email }),
    );
    expect(forbidden.status).toBe(403);

    const promote = await asAdmin(
      request(app).post("/api/admin/admins").send({ email: `  ${target.email.toUpperCase()} ` }),
    );

    expect(promote.status).toBe(200);
    expect(promote.body.data).toMatchObject({ id: target.id, role: "ADMIN", alreadyAdmin: false });

    const access = await request(app)
      .get("/api/admin/overview")
      .set("Authorization", `Bearer ${target.token}`);
    expect(access.status).toBe(200);

    const again = await asAdmin(
      request(app).post("/api/admin/admins").send({ email: target.email }),
    );
    expect(again.body.data.alreadyAdmin).toBe(true);
  });

  it("rejects unknown or invalid emails when promoting", async () => {
    const unknown = await asAdmin(
      request(app).post("/api/admin/admins").send({ email: "nobody-here@test.local" }),
    );
    expect(unknown.status).toBe(404);

    const invalid = await asAdmin(
      request(app).post("/api/admin/admins").send({ email: "not-an-email" }),
    );
    expect(invalid.status).toBe(400);
  });

  it("returns 404 when retrying an unknown analysis", async () => {
    const response = await asAdmin(
      request(app).post("/api/admin/analyses/999999999/retry"),
    );

    expect(response.status).toBe(404);
  });
});

async function createRun(
  userId: number,
  status: "QUEUED" | "PROCESSING" | "COMPLETED",
  queuedMinutesAgo: number,
): Promise<number> {
  const [resume] = await database.execute<import("mysql2").ResultSetHeader>(
    `
      INSERT INTO resumes (
        user_id, original_name, stored_name, file_path, mime_type, file_size,
        extracted_text, character_count, extraction_status, chunking_status, status
      )
      VALUES (?, 'admin-test.pdf', 'admin-test.pdf', 'uploads/admin-test.pdf',
              'application/pdf', 100, 'Node.js', 7, 'COMPLETED', 'COMPLETED', 'COMPLETED')
    `,
    [userId],
  );

  const [run] = await database.execute<import("mysql2").ResultSetHeader>(
    `
      INSERT INTO resume_analysis_runs (
        resume_id, user_id, analysis_type, status, prompt_version, queued_at, created_at
      )
      VALUES (?, ?, 'BASE', ?, 'test', UTC_TIMESTAMP() - INTERVAL ? MINUTE,
              UTC_TIMESTAMP() - INTERVAL ? MINUTE)
    `,
    [resume.insertId, userId, status, queuedMinutesAgo, queuedMinutesAgo],
  );

  return run.insertId;
}

describe("stuck analyses", () => {
  const stuckMinutes = env.admin.stuckMinutes;

  it("lists and cancels runs stuck longer than the threshold", async () => {
    const stuckId = await createRun(user.id, "QUEUED", stuckMinutes + 30);

    const overview = await asAdmin(request(app).get("/api/admin/overview"));
    expect(overview.body.data.analyses.stuck).toBeGreaterThanOrEqual(1);

    const list = await asAdmin(
      request(app).get("/api/admin/analyses").query({ status: "STUCK", pageSize: 100 }),
    );
    const listed = list.body.data.analyses.find((run: { id: number }) => run.id === stuckId);
    expect(listed?.isStuck).toBe(true);

    const cancel = await asAdmin(request(app).post(`/api/admin/analyses/${stuckId}/cancel`));
    expect(cancel.status).toBe(200);

    const [rows] = await database.execute<import("mysql2").RowDataPacket[]>(
      "SELECT status, error_code FROM resume_analysis_runs WHERE id = ?",
      [stuckId],
    );
    expect(rows[0]).toMatchObject({ status: "FAILED", error_code: "CANCELLED_BY_ADMIN" });

    // ยกเลิกซ้ำไม่ได้ (ไม่ใช่งานค้างแล้ว)
    const again = await asAdmin(request(app).post(`/api/admin/analyses/${stuckId}/cancel`));
    expect(again.status).toBe(409);
  });

  it("refuses to cancel runs that are still within the threshold or finished", async () => {
    const recentId = await createRun(user.id, "PROCESSING", 1);
    const doneId = await createRun(user.id, "COMPLETED", stuckMinutes + 30);

    for (const id of [recentId, doneId]) {
      const response = await asAdmin(request(app).post(`/api/admin/analyses/${id}/cancel`));
      expect(response.status).toBe(409);
      expect(response.body.code).toBe("ANALYSIS_NOT_STUCK");
    }

    const unknown = await asAdmin(request(app).post("/api/admin/analyses/999999999/cancel"));
    expect(unknown.status).toBe(404);
  });
});

describe("audit log", () => {
  it("records admin actions with actor, target and IP", async () => {
    const ip = "203.0.113.42";

    await asAdmin(
      request(app)
        .post(`/api/admin/users/${user.id}/unlock-login`)
        .set("X-Forwarded-For", ip),
    );

    const response = await asAdmin(request(app).get("/api/admin/audit-logs").query({ pageSize: 5 }));

    expect(response.status).toBe(200);
    expect(response.body.data.logs[0]).toMatchObject({
      adminId: admin.id,
      adminEmail: admin.email,
      action: "UNLOCK_LOGIN",
      targetType: "user",
      targetId: user.id,
      ipAddress: ip,
    });

    const forbidden = await asUser(request(app).get("/api/admin/audit-logs"));
    expect(forbidden.status).toBe(403);
  });
});

describe("trends", () => {
  it("returns one point per Bangkok day including empty days", async () => {
    for (const days of [7, 30]) {
      const response = await asAdmin(request(app).get("/api/admin/trends").query({ days }));

      expect(response.status).toBe(200);
      expect(response.body.data.series).toHaveLength(days);

      const today = new Date(Date.now() + 7 * 60 * 60_000).toISOString().slice(0, 10);
      expect(response.body.data.series.at(-1).date).toBe(today);
    }
  });

  it("rejects unsupported ranges", async () => {
    const response = await asAdmin(request(app).get("/api/admin/trends").query({ days: 10 }));
    expect(response.status).toBe(400);
  });
});

describe("admin page", () => {
  it("serves the admin page with strict security headers", async () => {
    const response = await request(app).get("/admin/");

    expect(response.status).toBe(200);
    expect(response.text).toContain("admin.js");
    expect(response.headers["content-security-policy"]).toContain("script-src 'self'");
    expect(response.headers["x-frame-options"]).toBe("DENY");
  });
});
