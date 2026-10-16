import { Router } from "express";

import type {
  Request,
  Response,
} from "express";

/*
 * เส้นทางวิเคราะห์แบบเก่า (ส่ง Resume ไป Gemini โดยตรง) — ปิดแล้ว
 * ใช้ POST/GET /api/resumes/:resumeId/analyses แทน (คิว + Ollama บนเครื่อง)
 *
 * ตอบ 410 Gone + ชี้ทางใหม่ แทน 404 — client เก่ารู้ว่าต้องย้ายไปไหน
 */
export const resumeAnalysisRouter =
  Router();

function analysisRouteGone(
  _req: Request,
  res: Response,
): void {
  res.setHeader(
    "Link",
    '</api/resumes/:resumeId/analyses>; rel="successor-version"',
  );

  res.status(410).json({
    success: false,
    message:
      "เส้นทางนี้ถูกปิดแล้ว ใช้ /api/resumes/:resumeId/analyses แทน",
    code: "ENDPOINT_REMOVED",
  });
}

resumeAnalysisRouter.post(
  "/:resumeId/analyze",
  analysisRouteGone,
);

resumeAnalysisRouter.get(
  "/:resumeId/analysis",
  analysisRouteGone,
);
