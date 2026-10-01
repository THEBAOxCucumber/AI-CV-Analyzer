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

    const answer = await generateAnswer(
        question,
        context,
        searchResults.length,
    );

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
}

/**
 * เรียก Gemini ตอบคำถามจาก Context
 * error ทุกแบบถูกแปลงเป็น AppError
 */
async function generateAnswer(
    question: string,
    context: string,
    evidenceCount: number,
): Promise<string> {
    let answer: string | undefined;

    try {
        console.log("Gemini generation request:", {
            model: env.gemini.generationModel,
            questionLength: question.length,
            contextLength: context.length,
            evidenceCount,
        });

        const response =
            await gemini.models.generateContent({
                model: env.gemini.generationModel,
                contents: buildAnalysisPrompt(
                    question,
                    context,
                ),
                config: {
                    temperature: 0.2,
                    maxOutputTokens: 700,
                },
            });

        answer = response.text?.trim();
    } catch (error) {
        throw toGeminiAppError(error);
    }

    if (!answer) {
        throw new AppError(
            "Gemini ไม่ได้ส่งข้อความคำตอบกลับมา",
            502,
            "GEMINI_EMPTY_RESPONSE",
        );
    }

    return answer;
}

/**
 * แปลง error จาก Gemini SDK เป็น AppError ตาม HTTP status
 */
function toGeminiAppError(
    error: unknown,
): AppError {
    if (error instanceof AppError) {
        return error;
    }

    console.error("========== GEMINI ANALYSIS ERROR ==========");
    console.dir(error, { depth: null });
    console.error("===========================================");

    const details =
        typeof error === "object" && error !== null
            ? (error as {
                status?: number;
                message?: string;
            })
            : {};

    const message =
        details.message ??
        "ไม่สามารถให้ Gemini วิเคราะห์ Resume ได้";

    switch (details.status) {
        case 400:
            return new AppError(
                `คำขอ Gemini ไม่ถูกต้อง: ${message}`,
                400,
                "GEMINI_BAD_REQUEST",
            );

        case 401:
        case 403:
            return new AppError(
                "Gemini API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้โมเดลนี้",
                502,
                "GEMINI_AUTHENTICATION_FAILED",
            );

        case 404:
            console.error("Gemini model not found:", {
                configuredModel:
                    env.gemini.generationModel,
                providerMessage: details.message,
            });

            return new AppError(
                "ไม่พบ Gemini Model ที่กำหนด กรุณาตรวจ GEMINI_GENERATION_MODEL",
                502,
                "GEMINI_MODEL_NOT_FOUND",
                {
                    model: env.gemini.generationModel,
                    providerMessage: details.message,
                },
            );

        case 429:
            return new AppError(
                "Gemini API เกินโควตาหรือ Rate Limit กรุณาลองใหม่ภายหลัง",
                429,
                "GEMINI_RATE_LIMITED",
            );

        case 503:
            return new AppError(
                "Gemini API ไม่พร้อมใช้งานชั่วคราว",
                503,
                "GEMINI_SERVICE_UNAVAILABLE",
            );

        default:
            return new AppError(
                message,
                502,
                "GEMINI_ANALYSIS_FAILED",
            );
    }
}