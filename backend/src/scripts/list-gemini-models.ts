import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

const apiKey = process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "ไม่พบ GEMINI_API_KEY ในไฟล์ .env",
  );
}

const gemini = new GoogleGenAI({
  apiKey,
});

async function main(): Promise<void> {
  console.log(
    "โมเดลที่รองรับ generateContent:\n",
  );

  const models = await gemini.models.list();

  for await (const model of models) {
    const actions =
      model.supportedActions ?? [];

    if (actions.includes("generateContent")) {
      console.log({
        name: model.name,
        displayName: model.displayName,
        supportedActions: actions,
      });
    }
  }
}

main().catch((error: unknown) => {
  console.error(
    "========== LIST MODELS ERROR ==========",
  );
  console.dir(error, { depth: null });
  console.error(
    "=======================================",
  );

  process.exit(1);
});