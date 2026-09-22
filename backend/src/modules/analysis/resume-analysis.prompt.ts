import type {
  CompletedResumeChunk,
} from "../resume/resume-chunk.repository.js";

import {
  BASE_RESUME_SCORE_LIMITS,
} from "./resume-analysis-rubric.js";

import { AppError } from "../../errors/app-error.js";

interface BuildResumeAnalysisPromptInput {
  chunks: CompletedResumeChunk[];

  analysisType:
  | "BASE"
  | "JOB_MATCH"
  | "COMBINED";

  jobDescription?: string | null;

}



function formatResumeChunks(
  chunks: CompletedResumeChunk[],
): string {
  return chunks
    .map((chunk) => {
      return [
        `[CHUNK_ID=${chunk.id}]`,
        `[CHUNK_INDEX=${chunk.chunkIndex}]`,
        `[SECTION=${chunk.section}]`,
        chunk.content,
      ].join("\n");
    })
    .join("\n\n---\n\n");
}

function buildResumeAnalysisPromptV2(
  input: BuildResumeAnalysisPromptInput,
): string {
  const context =
    formatResumeChunks(
      input.chunks,
    );

  const hasJobDescription =
    Boolean(
      input.jobDescription,
    );

  const jobContext =
    input.jobDescription
      ? `
Job Description:

${input.jobDescription}
`
      : `
ไม่มี Job Description

สำหรับ BASE analysis:
- วิเคราะห์คุณภาพ Resume อย่างอิสระ
- ห้ามสมมติ Job Description
- jobMatchScore ต้องเป็น null
- jobMatch ต้องเป็น null
`;

  return `
คุณเป็นผู้เชี่ยวชาญด้านการวิเคราะห์ Resume

Analysis Type:
${input.analysisType}

${jobContext}

วิเคราะห์โดยใช้เฉพาะข้อมูลที่ปรากฏใน Resume และ Job Description ที่ให้มาเท่านั้น

ข้อห้าม:
- ห้ามเดาข้อมูลที่ไม่มีใน Resume
- ห้ามเพิ่มประสบการณ์ ทักษะ ผลงาน หรือคุณสมบัติที่ไม่ได้ระบุ
- ห้ามใช้ความรู้ภายนอกเพื่อสมมติข้อมูลของผู้สมัคร
- ห้ามใช้ Markdown
- ห้ามครอบ JSON ด้วย Markdown code block
- ห้ามเพิ่ม field ที่ไม่ได้กำหนดไว้ใน Output

Base Resume Score:

scores ต้องประกอบด้วย 7 หมวดเท่านั้น:

1. contactInformation
คะแนนเต็ม ${BASE_RESUME_SCORE_LIMITS.contactInformation}
พิจารณาความครบถ้วนและความชัดเจนของข้อมูลติดต่อ

2. professionalSummary
คะแนนเต็ม ${BASE_RESUME_SCORE_LIMITS.professionalSummary}
พิจารณาความชัดเจน ความกระชับ และการสื่อจุดเด่นทางอาชีพ

3. skills
คะแนนเต็ม ${BASE_RESUME_SCORE_LIMITS.skills}
พิจารณาความชัดเจนของ technical skills และความสอดคล้องกับประสบการณ์หรือโครงการ

4. experience
คะแนนเต็ม ${BASE_RESUME_SCORE_LIMITS.experience}
พิจารณาหน้าที่ ความรับผิดชอบ ผลลัพธ์ ผลกระทบ และหลักฐานเชิงปริมาณเมื่อมีข้อมูล

5. projects
คะแนนเต็ม ${BASE_RESUME_SCORE_LIMITS.projects}
พิจารณารายละเอียดโครงการ บทบาท เทคโนโลยี และผลลัพธ์

6. education
คะแนนเต็ม ${BASE_RESUME_SCORE_LIMITS.education}
พิจารณาความครบถ้วนและความชัดเจนของข้อมูลการศึกษา

7. readability
คะแนนเต็ม ${BASE_RESUME_SCORE_LIMITS.readability}
พิจารณาโครงสร้าง ความเป็นระเบียบ ความชัดเจน และความอ่านง่าย

กฎ Base Resume Score:
- ทุกคะแนนต้องเป็นจำนวนเต็ม
- ทุกคะแนนต้องอยู่ในช่วงของหมวดนั้น
- baseResumeScore ต้องเท่ากับผลรวมของทั้ง 7 หมวด
- baseResumeScore ต้องอยู่ระหว่าง 0 ถึง 100
- ถ้าข้อมูลในหมวดใดไม่มีหรืออ่อน ให้ลดคะแนนหมวดนั้น
- ห้ามให้คะแนนจากข้อมูลที่คาดเดา

Job Match:

${
  hasJobDescription
    ? `
ต้องเปรียบเทียบ Resume กับ Job Description

jobMatchScore:
- เป็นจำนวนเต็มตั้งแต่ 0 ถึง 100
- ประเมินความสอดคล้องระหว่าง Resume กับ Job Description
- ต้องเท่ากับ jobMatch.score

jobMatch ต้องมี:
- score
- matchedSkills
- missingSkills
- keywordMatches

matchedSkills:
- ทักษะหรือคุณสมบัติที่ Job Description ต้องการ และมีหลักฐานอยู่ใน Resume

missingSkills:
- ทักษะหรือคุณสมบัติที่ Job Description ต้องการ แต่ไม่พบหลักฐานใน Resume

keywordMatches:
- คำสำคัญหรือแนวคิดจาก Job Description ที่ตรงกับ Resume

ห้ามถือว่าผู้สมัครมีทักษะเพียงเพราะทักษะนั้นปรากฏใน Job Description
`
    : `
เมื่อไม่มี Job Description:
- jobMatchScore ต้องเป็น null
- jobMatch ต้องเป็น null
`
}

กฎตาม Analysis Type:

BASE:
- วิเคราะห์ Base Resume Score
- jobMatchScore ต้องเป็น null
- jobMatch ต้องเป็น null

JOB_MATCH:
- วิเคราะห์ Base Resume Score
- วิเคราะห์ Job Match
- jobMatchScore ต้องเป็นตัวเลข
- jobMatch ต้องไม่เป็น null

COMBINED:
- วิเคราะห์ Base Resume Score
- วิเคราะห์ Job Match
- jobMatchScore ต้องเป็นตัวเลข
- jobMatch ต้องไม่เป็น null

Output ต้องเป็น JSON object ที่มีโครงสร้างนี้เท่านั้น:

{
  "baseResumeScore": number,
  "jobMatchScore": number | null,
  "scores": {
    "contactInformation": number,
    "professionalSummary": number,
    "skills": number,
    "experience": number,
    "projects": number,
    "education": number,
    "readability": number
  },
  "jobMatch": {
    "score": number,
    "matchedSkills": string[],
    "missingSkills": string[],
    "keywordMatches": string[]
  } | null,
  "summary": string,
  "strengths": string[],
  "weaknesses": string[],
  "recommendations": string[]
}

กฎสำหรับ summary, strengths, weaknesses และ recommendations:
- ต้องอ้างอิง Resume จริง
- ถ้ามี Job Description สามารถอ้างอิงความสอดคล้องกับงานได้
- ใช้ภาษาไทย
- เขียนให้เฉพาะเจาะจงและนำไปปรับ Resume ได้จริง

Resume Context:

${context}
`.trim();
}
type ResumeAnalysisPromptBuilder =
  (
    input: BuildResumeAnalysisPromptInput,
  ) => string;

const promptBuilders: Record<
  string,
  ResumeAnalysisPromptBuilder
> = {
  "resume-analysis-v2.0.0":
    buildResumeAnalysisPromptV2,
};

export function buildResumeAnalysisPrompt(
  input: BuildResumeAnalysisPromptInput,
  promptVersion: string,
): string {
  const builder =
    promptBuilders[promptVersion];

  if (!builder) {
    throw new AppError(
      "ไม่รองรับ Resume analysis prompt version นี้",
      500,
      "UNSUPPORTED_ANALYSIS_PROMPT_VERSION",
      {
        promptVersion,
      },
    );
  }

  return builder(input);
}