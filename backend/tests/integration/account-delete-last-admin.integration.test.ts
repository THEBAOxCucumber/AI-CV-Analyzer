import request from "supertest";
import type { RowDataPacket } from "mysql2";
import {
  describe,
  expect,
  it,
  vi,
} from "vitest";

/*
 * DB ทดสอบมี ADMIN หลายคนจากเทสต์อื่น → จำลองว่าเหลือ ADMIN คนเดียว
 * แยกไฟล์ไว้ เพื่อไม่ให้ mock กระทบเทสต์อื่น
 */
vi.mock("../../src/modules/auth/auth.repository.js", async (importOriginal) => ({
  ...(await importOriginal<typeof import("../../src/modules/auth/auth.repository.js")>()),
  countAdmins: vi.fn(async () => 1),
}));

import { app } from "../../src/app.js";
import { database } from "../../src/config/database.js";

const PASSWORD = "TestPassword123!";

describe("DELETE /api/auth/account — last admin", () => {
  it("refuses to delete the last ADMIN with 409 and keeps the account", async () => {
    const email = `last-admin-${Date.now()}-${Math.random()}@test.local`;

    const registerResponse = await request(app)
      .post("/api/auth/register")
      .send({ firstName: "Last", lastName: "Admin", email, password: PASSWORD });

    expect(registerResponse.status).toBe(201);

    const userId = registerResponse.body.data.user.id as number;

    await database.execute("UPDATE users SET role = 'ADMIN' WHERE id = ?", [userId]);

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email, password: PASSWORD });

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${loginResponse.body.data.token}`)
      .send({ currentPassword: PASSWORD, confirmEmail: email });

    expect(response.status).toBe(409);
    expect(response.body.code).toBe("LAST_ADMIN");

    const [rows] = await database.execute<RowDataPacket[]>(
      "SELECT id FROM users WHERE id = ?",
      [userId],
    );

    expect(rows).toHaveLength(1);
  });

  it("still lets a regular USER delete their account", async () => {
    const email = `last-admin-user-${Date.now()}-${Math.random()}@test.local`;

    await request(app)
      .post("/api/auth/register")
      .send({ firstName: "Regular", lastName: "User", email, password: PASSWORD });

    const loginResponse = await request(app)
      .post("/api/auth/login")
      .send({ email, password: PASSWORD });

    const response = await request(app)
      .delete("/api/auth/account")
      .set("Authorization", `Bearer ${loginResponse.body.data.token}`)
      .send({ currentPassword: PASSWORD, confirmEmail: email });

    expect(response.status).toBe(200);
  });
});
