import jwt from "jsonwebtoken";
import request from "supertest";
import {
    describe,
    expect,
    it,
} from "vitest";

import { app } from "../../src/app.js";
import {
    database,
} from "../../src/config/database.js";
import { env } from "../../src/config/env.js";

async function createTestUserAndToken() {
    const unique =
        `${Date.now()}-${Math.random()}`;

    const email =
        `auth-security-${unique}@test.local`;

    const password =
        "TestPassword123!";

    const registerResponse =
        await request(app)
            .post("/api/auth/register")
            .send({
                firstName: "Auth",
                lastName: "Security",
                email,
                password,
            });

    expect(
        registerResponse.status,
    ).toBe(201);

    const loginResponse =
        await request(app)
            .post("/api/auth/login")
            .send({
                email,
                password,
            });

    expect(
        loginResponse.status,
    ).toBe(200);

    const token =
        loginResponse.body.data
            ?.accessToken ??
        loginResponse.body.data
            ?.token;

    expect(token).toBeTruthy();

    const [rows] =
        await database.execute<
            Array<{
                id: number;
            } & import("mysql2").RowDataPacket>
        >(
            `
        SELECT id
        FROM users
        WHERE email = ?
        LIMIT 1
      `,
            [email],
        );

    expect(rows).toHaveLength(1);

    return {
        userId: rows[0].id,
        email,
        token: String(token),
    };
}

describe(
    "JWT authentication security",
    () => {
        it(
            "rejects an expired access token",
            async () => {
                const {
                    userId,
                    email,
                } =
                    await createTestUserAndToken();

                const token = jwt.sign(
                    {
                        sub: userId.toString(),
                        email,
                        role: "USER",
                    },
                    env.jwt.secret,
                    {
                        algorithm: "HS256",
                        expiresIn: -1,
                    },
                );

                const response =
                    await request(app)
                        .get("/api/profile")
                        .set(
                            "Authorization",
                            `Bearer ${token}`,
                        );

                expect(response.status).toBe(401);
                expect(response.body.code).toBe(
                    "TOKEN_EXPIRED",
                );
            },
        );

        it(
            "rejects a token with an invalid signature",
            async () => {
                const {
                    userId,
                    email,
                } =
                    await createTestUserAndToken();

                const token = jwt.sign(
                    {
                        sub: userId.toString(),
                        email,
                        role: "USER",
                    },
                    "definitely-not-the-real-secret",
                    {
                        algorithm: "HS256",
                        expiresIn: "15m",
                    },
                );

                const response =
                    await request(app)
                        .get("/api/profile")
                        .set(
                            "Authorization",
                            `Bearer ${token}`,
                        );

                expect(response.status).toBe(401);
                expect(response.body.code).toBe(
                    "INVALID_TOKEN",
                );
            },
        );

        it(
            "rejects a token signed with an unsupported algorithm",
            async () => {
                const {
                    userId,
                    email,
                } =
                    await createTestUserAndToken();

                const token = jwt.sign(
                    {
                        sub: userId.toString(),
                        email,
                        role: "USER",
                    },
                    "unused",
                    {
                        algorithm: "HS384",
                        expiresIn: "15m",
                    },
                );

                const response =
                    await request(app)
                        .get("/api/profile")
                        .set(
                            "Authorization",
                            `Bearer ${token}`,
                        );

                expect(response.status).toBe(401);
                expect(response.body.code).toBe(
                    "INVALID_TOKEN",
                );
            },
        );

        it(
            "rejects a valid token when its user no longer exists",
            async () => {
                const {
                    userId,
                    token,
                } =
                    await createTestUserAndToken();

                await database.execute(
                    `
            DELETE FROM users
            WHERE id = ?
          `,
                    [userId],
                );

                const response =
                    await request(app)
                        .get("/api/profile")
                        .set(
                            "Authorization",
                            `Bearer ${token}`,
                        );

                expect(response.status).toBe(401);
                expect(response.body.code).toBe(
                    "USER_NOT_FOUND",
                );
            },
        );

        it(
            "rejects a request without an access token",
            async () => {
                const response =
                    await request(app)
                        .get("/api/profile");

                expect(response.status).toBe(401);
                expect(response.body.code).toBe(
                    "TOKEN_REQUIRED",
                );
            },
        );

        it(
            "rejects an invalid authorization format",
            async () => {
                const response =
                    await request(app)
                        .get("/api/profile")
                        .set(
                            "Authorization",
                            "Basic abc",
                        );

                expect(response.status).toBe(401);
                expect(response.body.code).toBe(
                    "INVALID_TOKEN_FORMAT",
                );
            },
        );

    },
);