import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "ไม่พบ GEMINI_API_KEY",
  );
}

const model =
  process.env.GEMINI_GENERATION_MODEL ??
  "gemini-2.5-flash";

const gemini = new GoogleGenAI({
  apiKey,
});

async function main(): Promise<void> {
    const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error("ไม่พบ GEMINI_API_KEY ในไฟล์ .env");
}
  console.log({
    model,
    hasApiKey: Boolean(apiKey),
    apiKeyPrefix: apiKey.slice(0, 4),
  });

  const response =
    await gemini.models.generateContent({
      model,
      contents:
        "ตอบเป็นภาษาไทยสั้น ๆ ว่า Node.js คืออะไร",
      config: {
        temperature: 0.2,
        maxOutputTokens: 200,
      },
    });

  console.log({
    answer: response.text,
  });
}

main().catch((error: unknown) => {
  console.error(
    "========== GEMINI TEST ERROR ==========",
  );
  console.dir(error, { depth: null });
  console.error(
    "=======================================",
  );

  process.exit(1);
});