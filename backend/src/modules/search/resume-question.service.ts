import { env } from "../../config/env.js";
import { gemini } from "../../config/gemini.js";
import { AppError } from "../../errors/app-error.js";
import {
    semanticSearchResume,
} from "./semantic-search.service.js";
import type {
    ResumeQuestionAnswer,
    ResumeQuestionInput,
} from "./semantic-search.types.js";

const MAX_CONTEXT_CHARACTERS = 12_000;

function buildResumeContext(
    results: Awaited<
        ReturnType<typeof semanticSearchResume>
    >,
): string {
    const blocks: string[] = [];
    let currentLength = 0;

    for (const [index, result] of results.entries()) {
        const block = [
            `[หลักฐาน ${index + 1}]`,
            `chunkId: ${result.chunkId}`,
            `section: ${result.section}`,
            `chunkIndex: ${result.chunkIndex}`,
            `similarityScore: ${result.score.toFixed(4)}`,
            "content:",
            result.content,
        ].join("\n");

        if (
            currentLength + block.length >
            MAX_CONTEXT_CHARACTERS
        ) {
            break;
        }

        blocks.push(block);
        currentLength += block.length;
    }

    return blocks.join("\n\n---\n\n");

}


function buildAnalysisPrompt(
    question: string,
    context: string,
): string {
    return `
คุณเป็นระบบวิเคราะห์ Resume ที่ต้องตอบจากหลักฐานที่ให้มาเท่านั้น

กฎ:
1. ห้ามใช้ข้อมูลที่ไม่มีใน Context
2. ห้ามเดาหรือสร้างประสบการณ์ ทักษะ บริษัท วันที่ หรือผลงานเพิ่มเติม
3. หากหลักฐานไม่เพียงพอ ให้ตอบว่า "ไม่พบข้อมูลเพียงพอใน Resume"
4. ตอบเป็นภาษาไทย
5. ตอบคำถามโดยตรงก่อน แล้วจึงอธิบายหลักฐานสั้น ๆ
6. ระบุ section และ chunkId ที่ใช้ประกอบคำตอบ
7. similarityScore ใช้สำหรับการค้นคืนเท่านั้น ไม่ใช่หลักฐานว่าข้อมูลนั้นเป็นจริง

คำถาม:
${question}

Context จาก Resume:
${context}
`.trim();
}

export async function answerResumeQuestion(
    input: ResumeQuestionInput,
): Promise<ResumeQuestionAnswer> {
    const question = input.question.trim();

    if (!question) {
        throw new AppError(
            "กรุณาระบุคำถามเกี่ยวกับ Resume",
            400,
            "QUESTION_REQUIRED",
        );
    }

    const searchResults =
        await semanticSearchResume({
            userId: input.userId,
            resumeId: input.resumeId,
            query: question,
            limit: input.limit,
        });

    if (searchResults.length === 0) {
        return {
            resumeId: input.resumeId,
            question,
            answer:
                "ไม่พบข้อมูลเพียงพอใน Resume ที่เกี่ยวข้องกับคำถามนี้",
            hasRelevantEvidence: false,
            evidence: [],
        };
    }

    const context =
        buildResumeContext(searchResults);

    try {
        const prompt = buildAnalysisPrompt(
            question,
            context,
        );

        console.log("Gemini generation request:", {
            model: env.gemini.generationModel,
            questionLength: question.length,
            contextLength: context.length,
            evidenceCount: searchResults.length,
        });

        const response =
            await gemini.models.generateContent({
                model: env.gemini.generationModel,
                contents: prompt,
                config: {
                    temperature: 0.2,
                    maxOutputTokens: 700,
                },
            });

        const answer = response.text?.trim();

        if (!answer) {
            throw new AppError(
                "Gemini ไม่ได้ส่งข้อความคำตอบกลับมา",
                502,
                "GEMINI_EMPTY_RESPONSE",
            );
        }

        return {
            resumeId: input.resumeId,
            question,
            answer,
            hasRelevantEvidence: true,
            evidence: searchResults.map((result) => ({
                chunkId: result.chunkId,
                chunkIndex: result.chunkIndex,
                section: result.section,
                score: result.score,
                content: result.content,
            })),
        };

    } catch (error) {
        if (error instanceof AppError) {
            throw error;
        }

        console.error("========== GEMINI ANALYSIS ERROR ==========");
        console.dir(error, { depth: null });
        console.error("===========================================");

        const details =
            typeof error === "object" && error !== null
                ? (error as {
                    status?: number;
                    code?: number | string;
                    message?: string;
                })
                : {};

        const message =
            details.message ??
            "ไม่สามารถให้ Gemini วิเคราะห์ Resume ได้";

        if (details.status === 400) {
            throw new AppError(
                `คำขอ Gemini ไม่ถูกต้อง: ${message}`,
                400,
                "GEMINI_BAD_REQUEST",
            );
        }

        if (
            details.status === 401 ||
            details.status === 403
        ) {
            throw new AppError(
                "Gemini API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้โมเดลนี้",
                502,
                "GEMINI_AUTHENTICATION_FAILED",
            );
        }

        if (details.status === 404) {
            console.error("Gemini model not found:", {
                configuredModel:
                    env.gemini.generationModel,
                providerMessage: details.message,
            });

            throw new AppError(
                "ไม่พบ Gemini Model ที่กำหนด กรุณาตรวจ GEMINI_GENERATION_MODEL",
                502,
                "GEMINI_MODEL_NOT_FOUND",
                {
                    model: env.gemini.generationModel,
                    providerMessage: details.message,
                },
            );
        }

        if (details.status === 429) {
            throw new AppError(
                "Gemini API เกินโควตาหรือ Rate Limit กรุณาลองใหม่ภายหลัง",
                429,
                "GEMINI_RATE_LIMITED",
            );
        }

        if (details.status === 503) {
            throw new AppError(
                "Gemini API ไม่พร้อมใช้งานชั่วคราว",
                503,
                "GEMINI_SERVICE_UNAVAILABLE",
            );
        }

        throw new AppError(
            message,
            502,
            "GEMINI_ANALYSIS_FAILED",
        );
    }
}