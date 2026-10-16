import { GoogleGenAI } from "@google/genai";

import { env } from "./env.js";

/*
 * สร้างเมื่อใช้ครั้งแรก — ไม่ใช้ Gemini ก็ไม่ต้องมี GEMINI_API_KEY
 */
let client: GoogleGenAI | null = null;

export function getGemini(): GoogleGenAI {
  if (!env.gemini.apiKey) {
    throw new Error(
      "GEMINI_API_KEY is not set (required when EMBEDDING_PROVIDER=gemini)",
    );
  }

  client ??= new GoogleGenAI({
    apiKey: env.gemini.apiKey,
  });

  return client;
}