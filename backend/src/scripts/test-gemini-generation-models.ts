import "dotenv/config";

import { GoogleGenAI } from "@google/genai";

import { z } from "zod";

import {
  resumeAnalysisResultSchema,
} from "../modules/analysis/resume-analysis.schema.js";

const apiKey =
  process.env.GEMINI_API_KEY;

if (!apiKey) {
  throw new Error(
    "ไม่พบ GEMINI_API_KEY ในไฟล์ .env",
  );
}

const gemini =
  new GoogleGenAI({
    apiKey,
  });

const model =
  process.env.GEMINI_GENERATION_MODEL ??
  "gemini-3.6-flash";

async function runTest(
  name: string,
  contents: string,
  config?: any,
): Promise<void> {
  console.log(
    `\n========== ${name} ==========`,
  );

  console.log({
    model,
    promptCharacters:
      contents.length,
  });

  const startedAt =
    Date.now();

  try {
    const response =
      await gemini.models.generateContent({
        model,
        contents,
        config,
      });

    console.log({
      success: true,
      durationMs:
        Date.now() - startedAt,
      response:
        response.text?.slice(
          0,
          300,
        ),
    });
  } catch (error) {
    const candidate =
      error as {
        status?: number;
        message?: string;
      };

    console.log({
      success: false,
      durationMs:
        Date.now() - startedAt,
      status:
        candidate.status,
      error:
        candidate.message ??
        String(error),
    });
  }
}

async function main(): Promise<void> {
  console.log(
    "========== GEMINI 3.6 DIAGNOSTIC ==========",
  );

  console.log({
    model,
  });

  // TEST 1: tiny request
  await runTest(
    "TEST 1 - tiny",
    "Reply only with OK",
    {
      temperature: 0.1,
      maxOutputTokens: 50,
    },
  );

  // TEST 2: prompt ~5,000 characters
  const largePrompt =
    "Analyze this resume carefully. ".repeat(
      180,
    );

  await runTest(
    "TEST 2 - large prompt",
    largePrompt,
    {
      temperature: 0.1,
      maxOutputTokens: 2500,
    },
  );

  // TEST 3: JSON mode
  const jsonPrompt = `
Return JSON only.

The JSON must contain:
- summary: string
- score: number

Resume:
${"Software engineer with TypeScript, React, Node.js and SQL experience. ".repeat(
  70,
)}
`;

  await runTest(
    "TEST 3 - JSON mode",
    jsonPrompt,
    {
      temperature: 0.1,
      maxOutputTokens: 2500,

      responseMimeType:
        "application/json",
    },
  );

  // TEST 4: JSON mode + simple schema
  await runTest(
    "TEST 4 - simple JSON schema",
    jsonPrompt,
    {
      temperature: 0.1,
      maxOutputTokens: 2500,

      responseMimeType:
        "application/json",

      responseJsonSchema: {
        type: "object",

        properties: {
          summary: {
            type: "string",
          },

          score: {
            type: "number",
          },
        },

        required: [
          "summary",
          "score",
        ],

        additionalProperties:
          false,
      },
    },
  );

  // TEST 5:
// JSON mode + production Resume Analysis schema
await runTest(
  "TEST 5 - production resume schema",
  `
Analyze the following resume.

Return a complete resume analysis
that matches the required JSON schema.

Resume:
${"Software engineer with TypeScript, React, Node.js, MySQL, REST API, Git and Docker experience. ".repeat(
  55,
)}
`,
  {
    temperature: 0.1,
    maxOutputTokens: 2500,

    responseMimeType:
      "application/json",

    responseJsonSchema:
      z.toJSONSchema(
        resumeAnalysisResultSchema,
        {
          target: "draft-07",
        },
      ),
  },
);

  console.log(
    "\n========== TEST FINISHED ==========",
  );
}

main().catch(
  (error: unknown) => {
    console.error(
      "========== TEST ERROR ==========",
    );

    console.dir(
      error,
      {
        depth: null,
      },
    );

    process.exit(1);
  },
);