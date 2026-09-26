import request from "supertest";
import {
    beforeEach,
    describe,
    expect,
    it,
    vi,
} from "vitest";

import { app } from "../../src/app.js";
import { database } from "../../src/config/database.js";
import {
    sendMail,
    type MailMessage,
} from "../../src/modules/mail/mail.service.js";

/*
 * sendMail ถูก mock ใน tests/setup.ts
 */
const mockedSendMail = vi.mocked(sendMail);

const PASSWORD = "TestPassword123!";
const NEW_PASSWORD = "NewPassword456!";

async function registerUser(): Promise<string> {
    const email =
        `password-reset-${Date.now()}-${Math.random()}@test.local`;

    const response =
        await request(app)
            .post("/api/auth/register")
            .send({
                firstName: "Reset",
                lastName: "Password",
                email,
                password: PASSWORD,
            });

    expect(response.status).toBe(201);

    return email;
}

function sentMailsTo(
    email: string,
): MailMessage[] {
    return mockedSendMail.mock.calls
        .map(([message]) => message)
        .filter((message) => message.to === email);
}

function extractOtp(
    message: MailMessage,
): string {
    const match =
        /\b(\d{6})\b/.exec(message.text);

    if (!match) {
        throw new Error("OTP not found in email");
    }

    return match[1];
}

async function requestOtp(
    email: string,
): Promise<string> {
    const response =
        await request(app)
            .post("/api/auth/forgot-password")
            .send({ email });

    expect(response.status).toBe(200);

    const mails = sentMailsTo(email);

    return extractOtp(mails[mails.length - 1]);
}

function resetPassword(
    email: string,
    otp: string,
    newPassword = NEW_PASSWORD,
) {
    return request(app)
        .post("/api/auth/reset-password")
        .send({ email, otp, newPassword });
}

function wrongOtp(otp: string): string {
    return otp === "000000"
        ? "111111"
        : "000000";
}

beforeEach(() => {
    mockedSendMail.mockClear();
});

describe("Password reset with OTP", () => {
    it("returns the same message for an unknown email without sending mail", async () => {
        const response =
            await request(app)
                .post("/api/auth/forgot-password")
                .send({
                    email: `nobody-${Date.now()}@test.local`,
                });

        expect(response.status).toBe(200);
        expect(response.body.message).toBe(
            "หากอีเมลนี้มีบัญชีอยู่ในระบบ เราได้ส่งรหัส OTP ไปแล้ว",
        );
        expect(mockedSendMail).not.toHaveBeenCalled();
    });

    it("resets the password with a valid OTP and notifies by email", async () => {
        const email = await registerUser();
        const otp = await requestOtp(email);

        const wrong =
            await resetPassword(email, wrongOtp(otp));

        expect(wrong.status).toBe(400);
        expect(wrong.body.code).toBe("INVALID_OTP");

        const response =
            await resetPassword(email, otp);

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

        const subjects =
            sentMailsTo(email).map((mail) => mail.subject);

        expect(
            subjects.some((subject) =>
                subject.includes("ถูกเปลี่ยนแล้ว"),
            ),
        ).toBe(true);

        const reused =
            await resetPassword(
                email,
                otp,
                "AnotherPassword789!",
            );

        expect(reused.status).toBe(400);
        expect(reused.body.code).toBe(
            "INVALID_OR_EXPIRED_OTP",
        );
    });

    it("does not send a second OTP within the cooldown", async () => {
        const email = await registerUser();

        await requestOtp(email);

        const second =
            await request(app)
                .post("/api/auth/forgot-password")
                .send({ email });

        expect(second.status).toBe(200);
        expect(sentMailsTo(email)).toHaveLength(1);
    });

    it("locks the OTP after too many wrong attempts", async () => {
        const email = await registerUser();
        const otp = await requestOtp(email);

        let lastResponse;

        for (let attempt = 0; attempt < 5; attempt += 1) {
            lastResponse =
                await resetPassword(email, wrongOtp(otp));
        }

        expect(lastResponse?.body.code).toBe(
            "OTP_TOO_MANY_ATTEMPTS",
        );

        const correct =
            await resetPassword(email, otp);

        expect(correct.status).toBe(400);
        expect(correct.body.code).toBe(
            "OTP_TOO_MANY_ATTEMPTS",
        );
    });

    it("rejects an expired OTP", async () => {
        const email = await registerUser();
        const otp = await requestOtp(email);

        await database.execute(
            `
              UPDATE password_reset_otps otp
              JOIN users u ON u.id = otp.user_id
              SET otp.expires_at = DATE_SUB(NOW(), INTERVAL 1 MINUTE)
              WHERE u.email = ?
            `,
            [email],
        );

        const response =
            await resetPassword(email, otp);

        expect(response.status).toBe(400);
        expect(response.body.code).toBe(
            "INVALID_OR_EXPIRED_OTP",
        );
    });

    it("invalidates the previous OTP when a new one is issued", async () => {
        const email = await registerUser();
        const firstOtp = await requestOtp(email);

        /*
         * เลื่อนเวลาสร้างให้พ้น cooldown
         */
        await database.execute(
            `
              UPDATE password_reset_otps otp
              JOIN users u ON u.id = otp.user_id
              SET otp.created_at = DATE_SUB(NOW(), INTERVAL 2 MINUTE)
              WHERE u.email = ?
            `,
            [email],
        );

        const secondOtp = await requestOtp(email);

        if (firstOtp !== secondOtp) {
            const old =
                await resetPassword(email, firstOtp);

            expect(old.status).toBe(400);
        }

        const response =
            await resetPassword(email, secondOtp);

        expect(response.status).toBe(200);
    });

    it("sends a notification when the password is changed in settings", async () => {
        const email = await registerUser();

        const login =
            await request(app)
                .post("/api/auth/login")
                .send({ email, password: PASSWORD });

        const response =
            await request(app)
                .post("/api/auth/change-password")
                .set(
                    "Authorization",
                    `Bearer ${login.body.data.token}`,
                )
                .send({
                    currentPassword: PASSWORD,
                    newPassword: NEW_PASSWORD,
                });

        expect(response.status).toBe(200);
        expect(sentMailsTo(email)).toHaveLength(1);
        expect(sentMailsTo(email)[0].subject).toContain(
            "ถูกเปลี่ยนแล้ว",
        );
    });
});
