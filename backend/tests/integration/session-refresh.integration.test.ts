import jwt from "jsonwebtoken";
import request from "supertest";
import {
    describe,
    expect,
    it,
} from "vitest";

import { app } from "../../src/app.js";
import { env } from "../../src/config/env.js";

const PASSWORD = "TestPassword123!";

async function createUser() {
    const email =
        `session-refresh-${Date.now()}-${Math.random()}@test.local`;

    const registerResponse =
        await request(app)
            .post("/api/auth/register")
            .send({
                firstName: "Session",
                lastName: "Refresh",
                email,
                password: PASSWORD,
            });

    expect(registerResponse.status).toBe(201);

    const loginResponse =
        await request(app)
            .post("/api/auth/login")
            .send({ email, password: PASSWORD });

    expect(loginResponse.status).toBe(200);

    return {
        id: loginResponse.body.data.user.id as number,
        email,
    };
}

// token ที่ออกเองได้ — ใช้จำลอง token ใกล้หมดอายุ / หมดอายุแล้ว / role ไม่ตรง DB
function signToken(
    user: { id: number; email: string },
    options: { role?: "USER" | "ADMIN"; expiresIn?: number } = {},
) {
    return jwt.sign(
        {
            sub: String(user.id),
            email: user.email,
            role: options.role ?? "USER",
        },
        env.jwt.secret,
        {
            algorithm: "HS256",
            expiresIn: options.expiresIn ?? 60,
        },
    );
}

function expOf(token: string): number {
    return (jwt.decode(token) as { exp: number }).exp;
}

describe("POST /api/auth/refresh", () => {
    it("issues a new token that expires later than the current one", async () => {
        const user = await createUser();
        const nearlyExpired = signToken(user, { expiresIn: 60 });

        const response =
            await request(app)
                .post("/api/auth/refresh")
                .set("Authorization", `Bearer ${nearlyExpired}`);

        expect(response.status).toBe(200);
        expect(response.body.data.user.email).toBe(user.email);

        const newToken = response.body.data.token as string;
        expect(expOf(newToken)).toBeGreaterThan(expOf(nearlyExpired) + 60);

        // token ใหม่ใช้งานได้จริง
        const me =
            await request(app)
                .get("/api/auth/me")
                .set("Authorization", `Bearer ${newToken}`);

        expect(me.status).toBe(200);
    });

    it("refuses an expired token", async () => {
        const user = await createUser();
        const expired = signToken(user, { expiresIn: -10 });

        const response =
            await request(app)
                .post("/api/auth/refresh")
                .set("Authorization", `Bearer ${expired}`);

        expect(response.status).toBe(401);
        expect(response.body.code).toBe("TOKEN_EXPIRED");
    });

    it("requires a token", async () => {
        const response =
            await request(app)
                .post("/api/auth/refresh");

        expect(response.status).toBe(401);
    });

    it("takes the role from the database, not from the old token", async () => {
        const user = await createUser();
        const claimsAdmin = signToken(user, { role: "ADMIN" });

        const response =
            await request(app)
                .post("/api/auth/refresh")
                .set("Authorization", `Bearer ${claimsAdmin}`);

        expect(response.status).toBe(200);
        expect(
            (jwt.decode(response.body.data.token) as { role: string }).role,
        ).toBe("USER");
    });
});
