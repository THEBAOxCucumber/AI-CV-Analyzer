import { z } from "zod";

import {
  resumeAnalysisResultSchema,
} from "../modules/analysis/resume-analysis.schema.js";

import {
  normalizeResumeAnalysisResult,
} from "../modules/analysis/resume-analysis-normalizer.js";

import "dotenv/config";

import { Ollama } from "ollama";

const host =
  process.env.OLLAMA_HOST ??
  "http://127.0.0.1:11434";

const model =
  process.env.OLLAMA_MODEL ??
  "qwen3:4b-instruct";

const ollama = new Ollama({
  host,
});

async function main(): Promise<void> {
  console.log(
    "========== OLLAMA PRODUCTION SCHEMA TEST ==========",
  );

  console.log({
    host,
    model,
  });

  const schema =
    z.toJSONSchema(
      resumeAnalysisResultSchema,
      {
        target: "draft-07",
      },
    );

  const prompt = `
Analyze the following resume.

Return a complete resume analysis
matching the required JSON schema.

This is a BASE resume analysis.
There is no job description.

Resume:

John Doe
Software Engineer

Professional Summary:
Software engineer experienced in building
web applications and REST APIs.

Skills:
TypeScript, JavaScript, React, Node.js,
Express, MySQL, Git, Docker

Experience:
Software Engineer
- Developed REST APIs using Node.js and Express.
- Built React and TypeScript applications.
- Designed MySQL database schemas.
- Used Git and Docker in development workflows.

Projects:
AI Resume Analyzer
- Built resume upload and analysis features.
- Implemented React frontend and Node.js backend.

Education:
Bachelor's Degree in Computer Science.
`;

  const startedAt =
    Date.now();

  const response =
    await ollama.chat({
      model,

      messages: [
        {
          role: "user",
          content: prompt,
        },
      ],

      stream: false,

      format: schema,

      options: {
        temperature: 0.1,
      },
    });

  console.log({
    durationMs:
      Date.now() - startedAt,
  });

  const raw =
    response.message.content;

  console.log(
    "\n========== RAW RESPONSE ==========",
  );

  console.log(raw);

  const json =
  JSON.parse(raw);

const normalized =
  normalizeResumeAnalysisResult(
    json,
  );

console.log(
  "\n========== NORMALIZED ==========",
);

console.dir(normalized, {
  depth: null,
});

const parsed =
  resumeAnalysisResultSchema.safeParse(
    normalized,
  );
  console.log(
    "\n========== ZOD RESULT ==========",
  );

  if (!parsed.success) {
    console.dir(
      parsed.error.issues,
      {
        depth: null,
      },
    );

    throw new Error(
      "Ollama response did not match resumeAnalysisResultSchema",
    );
  }

  console.log({
    success: true,
    data: parsed.data,
  });
}

main().catch(
  (error: unknown) => {
    console.error(
      "========== OLLAMA ERROR ==========",
    );

    console.dir(error, {
      depth: null,
    });

    process.exit(1);
  },
);