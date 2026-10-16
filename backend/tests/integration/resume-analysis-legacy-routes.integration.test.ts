import request from "supertest";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  app,
} from "../../src/app.js";

/*
 * เส้นทางเก่าที่ส่ง Resume ไป Gemini ถูกปิด — ตอบ 410 + ชี้ทางใหม่
 */
describe(
  "removed legacy routes",
  () => {
    it.each([
      ["post", "/api/resumes/1/analyze"],
      ["get", "/api/resumes/1/analysis"],
    ] as const)(
      "%s %s returns 410 with the successor link",
      async (method, path) => {
        const response =
          await request(app)[method](path);

        expect(response.status).toBe(410);
        expect(response.body.code).toBe("ENDPOINT_REMOVED");
        expect(response.headers.link).toContain(
          "/api/resumes/:resumeId/analyses",
        );
      },
    );

    it(
      "no longer exposes the Gemini question endpoint",
      async () => {
        const response =
          await request(app)
            .post("/api/resumes/1/ask")
            .send({ question: "test" });

        expect(response.status).toBe(404);
      },
    );
  },
);
