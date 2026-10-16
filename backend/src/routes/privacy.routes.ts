import { Router, type Request, type Response } from "express";

import { env } from "../config/env.js";

/*
 * ข้อมูลสาธารณะสำหรับหน้านโยบายความเป็นส่วนตัว
 * บอกว่าข้อความ Resume ถูกประมวลผลที่ไหน ตามการตั้งค่าจริงของเซิร์ฟเวอร์
 * (ไม่มีความลับ — แค่ชื่อผู้ให้บริการ)
 */
export const privacyRouter = Router();

privacyRouter.get("/", (_req: Request, res: Response) => {
  res.status(200).json({
    success: true,
    data: {
      // "ollama" = บนเครื่องเซิร์ฟเวอร์ / "gemini" = ส่งไป Google Gemini API
      embeddingProvider: env.embedding.provider,
      analysisProvider: "ollama",
    },
  });
});
