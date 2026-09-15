import request from "supertest";
import {
    describe,
    expect,
    it,
} from "vitest";

import { app } from "../../src/app.js";

describe(
    "request body size limit",
    () => {
        it(
            "rejects JSON payload larger than 1 MB",
            async () => {
                const oversizedPayload = {
                    data: "a".repeat(
                        2 * 1024 * 1024,
                    ),
                };

                const response =
                    await request(app)
                        .post("/api/auth/login")
                        .send(oversizedPayload);
                        
                expect(response.status).toBe(
                    413,
                );

                expect(response.status).toBe(413);

                expect(response.body).toMatchObject({
                    success: false,
                    code: "REQUEST_BODY_TOO_LARGE",
                });
            },
        );
    },
);