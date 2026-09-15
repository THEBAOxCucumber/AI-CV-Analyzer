import request from "supertest";

import {
  describe,
  expect,
  it,
} from "vitest";

import {
  app,
} from "../../src/app.js";

describe(
  "legacy resume analysis routes",
  () => {
    it(
      "marks POST /api/resumes/:resumeId/analyze as deprecated",
      async () => {
        const response =
          await request(app)
            .post(
              "/api/resumes/1/analyze",
            );

        expect(
          response.headers.deprecation,
        ).toBe("true");

        expect(
          response.headers.sunset,
        ).toBe(
          "Wed, 31 Dec 2026 23:59:59 GMT",
        );

        expect(
          response.headers.link,
        ).toContain(
          "/api/resumes/:resumeId/analyses",
        );
      },
    );

    it(
      "marks GET /api/resumes/:resumeId/analysis as deprecated",
      async () => {
        const response =
          await request(app)
            .get(
              "/api/resumes/1/analysis",
            );

        expect(
          response.headers.deprecation,
        ).toBe("true");

        expect(
          response.headers.sunset,
        ).toBe(
          "Wed, 31 Dec 2026 23:59:59 GMT",
        );

        expect(
          response.headers.link,
        ).toContain(
          "/api/resumes/:resumeId/analyses",
        );
      },
    );
  },
);