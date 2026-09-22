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

const models = [
  "gemini-3.5-flash",
  "gemini-3.6-flash",
  "gemini-3.7-flash",
  "gemini-3.8-flash",
  "gemini-flash-latest",
];

interface GeminiErrorDetails {
  status?: number;
  message?: string;
}

function getErrorDetails(
  error: unknown,
): GeminiErrorDetails {
  if (
    typeof error === "object" &&
    error !== null
  ) {
    const candidate =
      error as {
        status?: unknown;
        message?: unknown;
      };

    return {
      status:
        typeof candidate.status === "number"
          ? candidate.status
          : undefined,

      message:
        typeof candidate.message === "string"
          ? candidate.message
          : undefined,
    };
  }

  return {};
}

async function testModel(
  model: string,
): Promise<void> {
  const startedAt = Date.now();

  console.log(
    `\n========== ${model} ==========`,
  );

  try {
    const response =
      await gemini.models.generateContent({
        model,

        contents:
          "Reply with exactly: OK",
      });

    console.log({
      model,
      success: true,
      durationMs:
        Date.now() - startedAt,
      response:
        response.text,
    });
  } catch (error) {
    const details =
      getErrorDetails(error);

    console.log({
      model,
      success: false,
      durationMs:
        Date.now() - startedAt,
      status:
        details.status ?? "unknown",
      error:
        details.message ??
        (error instanceof Error
          ? error.message
          : String(error)),
    });
  }
}

async function main(): Promise<void> {
  console.log(
    "Testing Gemini generation models...",
  );

  for (const model of models) {
    await testModel(model);
  }

  console.log(
    "\n========== TEST FINISHED ==========",
  );
}

main().catch((error: unknown) => {
  console.error(
    "Unexpected test error:",
    error,
  );

  process.exit(1);
});