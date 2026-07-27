import { Router, type Request, type Response } from "express";

import { database } from "../config/database.js";

export const healthRouter = Router();

healthRouter.get("/", async (_req: Request, res: Response) => {
  try {
    await database.query("SELECT 1");

    res.status(200).json({
      success: true,
      message: "API and database are working",
      data: {
        api: "healthy",
        database: "connected",
        timestamp: new Date().toISOString(),
      },
    });
  } catch (error) {
    console.error("Health check error:", error);

    res.status(503).json({
      success: false,
      message: "Database connection failed",
      data: {
        api: "healthy",
        database: "disconnected",
      },
    });
  }
});