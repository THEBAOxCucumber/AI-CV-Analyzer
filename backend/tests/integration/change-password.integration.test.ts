import request from "supertest";
import {
    describe,
    expect,
    it,
} from "vitest";

import { app } from "../../src/app.js";

const PASSWORD = "TestPassword123!";
const NEW_PASSWORD = "NewPassword456!";

async function createUserAndToken() {
    const email =
        `change-password-${Date.now()}-${Math.random()}@test.local`;

    const registerResponse =
        await request(app)
            .post("/api/auth/register")
            .send({
                firstName: "Change",
                lastName: "Password",
                email,
                password: PASSWORD,
            });

    expect(registerResponse.status).toBe(201);

    const loginResponse =
        await request(app)
            .post("/api/auth/login")
            .send({
                email,
                password: PASSWORD,
            });

    expect(loginResponse.status).toBe(200);

    return {
        email,
        token: loginResponse.body.data.token as string,
    };
}

describe("POST /api/auth/change-password", () => {
    it("changes the password so only the new one can log in", async () => {
        const { email, token } =
            await createUserAndToken();

        const response =
            await request(app)
                .post("/api/auth/change-password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    currentPassword: PASSWORD,
                    newPassword: NEW_PASSWORD,
                });

        expect(response.status).toBe(200);

        const oldLogin =
            await request(app)
                .post("/api/auth/login")
                .send({ email, password: PASSWORD });

        expect(oldLogin.status).toBe(401);

        const newLogin =
            await request(app)
                .post("/api/auth/login")
                .send({ email, password: NEW_PASSWORD });

        expect(newLogin.status).toBe(200);
    });

    it("rejects a wrong current password with 400", async () => {
        const { token } =
            await createUserAndToken();

        const response =
            await request(app)
                .post("/api/auth/change-password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    currentPassword: "WrongPassword999!",
                    newPassword: NEW_PASSWORD,
                });

        expect(response.status).toBe(400);
        expect(response.body.code).toBe(
            "INVALID_CURRENT_PASSWORD",
        );
    });

    it("rejects a weak new password", async () => {
        const { token } =
            await createUserAndToken();

        const response =
            await request(app)
                .post("/api/auth/change-password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    currentPassword: PASSWORD,
                    newPassword: "short",
                });

        expect(response.status).toBe(400);
    });

    it("rejects a new password equal to the current one", async () => {
        const { token } =
            await createUserAndToken();

        const response =
            await request(app)
                .post("/api/auth/change-password")
                .set("Authorization", `Bearer ${token}`)
                .send({
                    currentPassword: PASSWORD,
                    newPassword: PASSWORD,
                });

        expect(response.status).toBe(400);
    });

    it("requires authentication", async () => {
        const response =
            await request(app)
                .post("/api/auth/change-password")
                .send({
                    currentPassword: PASSWORD,
                    newPassword: NEW_PASSWORD,
                });

        expect(response.status).toBe(401);
    });
});
