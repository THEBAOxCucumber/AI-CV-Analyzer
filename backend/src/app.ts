import { fileURLToPath } from "node:url";

import cors from "cors";
import express from "express";
import { adminRouter } from "./modules/admin/admin.routes.js";
import {
  env,
} from "./config/env.js";
import {
  analysisRouter,
} from "./modules/analysis/analysis.routes.js";
import {
  errorHandler,
  notFoundHandler,
} from "./middleware/error.middleware.js";
import { authRouter } from "./modules/auth/auth.routes.js";
import { profileRouter } from "./modules/profile/profile.routes.js";
import { healthRouter } from "./routes/health.routes.js";
import { resumeRouter } from "./modules/resume/resume.routes.js";
import {
  semanticSearchRouter,
} from "./modules/search/semantic-search.routes.js";
import {
  resumeAnalysisRouter,
} from "./modules/analysis/resume-analysis.routes.js";

import { 
  jobDescriptionRouter,
} from "./modules/job-description/job-description.routes.js";

import {
  jobRouter,
} from "./modules/job/job.routes.js";


export const app = express();

// ไม่บอก client ว่าใช้ Express (S5689)
app.disable("x-powered-by");

// เชื่อ X-Forwarded-For จาก proxy ในเครื่อง → req.ip = IP จริง (ใช้กับ rate limit)
app.set("trust proxy", env.rateLimit.trustProxy);

app.use(
  cors({
    origin: env.cors.origin,
    credentials: true,
  }),
);

// app.use(express.json());
// app.use(express.urlencoded({ extended: true }));

app.use(
  express.json({
    limit: "1mb",
  }),
);

app.use(
  express.urlencoded({
    extended: true,
    limit: "1mb",
  }),
);


app.get("/", (_req, res) => {
  res.status(200).json({
    success: true,
    message: "AI Resume Analyzer API",
  });
});

app.use("/api/health", healthRouter);
app.use("/api/auth", authRouter);
app.use("/api/profile", profileRouter);
app.use("/api/resumes", resumeRouter);
app.use(
  "/api/resumes",
  semanticSearchRouter,
);
app.use(
  "/api/resumes",
  resumeAnalysisRouter,
);
app.use(
  "/api/analyses",
  analysisRouter,
);
app.use(
  "/api/job-descriptions",
  jobDescriptionRouter,
);

app.use(
  "/api/jobs",
  jobRouter,
);

app.use(
  "/api/admin",
  adminRouter,
);

/*
 * หน้า Admin (HTML/JS ธรรมดา) — http://localhost:5000/admin/
 * ไม่ผ่าน Vite proxy → tester จาก tunnel เข้าไม่ถึง
 * public/ อยู่ระดับเดียวกับ src/ และ dist/
 */
const adminPublicDir = fileURLToPath(
  new URL("../public/admin", import.meta.url),
);

app.use(
  "/admin",
  (_req, res, next) => {
    res.set({
      "Content-Security-Policy": [
        "default-src 'self'",
        "script-src 'self'",
        "style-src 'self' https://fonts.googleapis.com",
        "font-src https://fonts.gstatic.com",
        "img-src 'self' data:",
        "connect-src 'self'",
        "base-uri 'none'",
        "form-action 'self'",
        "frame-ancestors 'none'",
      ].join("; "),
      "X-Content-Type-Options": "nosniff",
      "X-Frame-Options": "DENY",
      "Referrer-Policy": "no-referrer",
      "Cache-Control": "no-store",
    });

    next();
  },
  express.static(adminPublicDir),
);


/*
 * ใช้เมื่อไม่พบ Route
 * ต้องอยู่หลัง Route ทั้งหมด
 */
app.use(notFoundHandler);

/*
 * Error Handler กลาง
 * ต้องอยู่ท้ายสุดเสมอ
 */
app.use(errorHandler);