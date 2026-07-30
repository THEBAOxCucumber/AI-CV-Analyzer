import cors from "cors";
import express from "express";

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


export const app = express();

app.use(
  cors({
    origin: "http://localhost:5173",
    credentials: true,
  }),
);

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

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

app.use(notFoundHandler);
app.use(errorHandler);

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