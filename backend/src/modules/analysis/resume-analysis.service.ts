import { z } from "zod";

import { env } from "../../config/env.js";
import { gemini } from "../../config/gemini.js";
import { AppError } from "../../errors/app-error.js";
import {
    findCompletedChunksByResumeId,
} from "../resume/resume-chunk.repository.js";
import {
    findResumeById,
} from "../resume/resume.repository.js";
import {
    buildResumeAnalysisPrompt,
} from "./resume-analysis.prompt.js";
import {
    findResumeAnalysis,
    markAnalysisCompleted,
    markAnalysisFailed,
    upsertAnalysisProcessing,
} from "./resume-analysis.repository.js";
import {
    resumeAnalysisResultSchema,
} from "./resume-analysis.schema.js";

import type {
    ResumeAnalysisResult,
} from "./resume-analysis.schema.js";

import type {
    AnalyzeResumeInput,
    ResumeAnalysisRecord,
} from "./resume-analysis.types.js";

function calculateBaseResumeScore(
    result: ResumeAnalysisResult,
): number {
    return Object.values(result.scores).reduce(
        (sum, score) => sum + score,
        0,
    );
}

function validateScoreTotal(
    result: ResumeAnalysisResult,
): void {
    const calculatedBaseScore =
        calculateBaseResumeScore(result);

    if (
        calculatedBaseScore !==
        result.baseResumeScore
    ) {
        throw new AppError(
            "ผลรวมคะแนน Resume ไม่ตรงกับ baseResumeScore",
            502,
            "INVALID_BASE_RESUME_SCORE_TOTAL",
            {
                declaredBaseResumeScore:
                    result.baseResumeScore,
                calculatedBaseScore,
            },
        );
    }

    if (
        result.jobMatch === null &&
        result.jobMatchScore !== null
    ) {
        throw new AppError(
            "jobMatchScore ต้องเป็น null เมื่อไม่มี Job Match",
            502,
            "INVALID_JOB_MATCH_SCORE",
        );
    }

    if (
        result.jobMatch !== null &&
        result.jobMatchScore !==
        result.jobMatch.score
    ) {
        throw new AppError(
            "jobMatchScore ไม่ตรงกับ jobMatch.score",
            502,
            "INVALID_JOB_MATCH_SCORE",
            {
                declaredJobMatchScore:
                    result.jobMatchScore,
                calculatedJobMatchScore:
                    result.jobMatch.score,
            },
        );
    }
}

function limitResumeContext<
    T extends {
        content: string;
    },
>(
    chunks: T[],
    maxCharacters: number,
): T[] {
    const selected: T[] = [];
    let currentLength = 0;

    for (const chunk of chunks) {
        const nextLength =
            currentLength + chunk.content.length;

        if (nextLength > maxCharacters) {
            break;
        }

        selected.push(chunk);
        currentLength = nextLength;
    }

    return selected;
}

interface GeminiErrorDetails {
    status?: number;
    code?: number | string;
    message?: string;
}

function getGeminiErrorDetails(
    error: unknown,
): GeminiErrorDetails {
    if (
        typeof error !== "object" ||
        error === null
    ) {
        return {};
    }

    return error as GeminiErrorDetails;
}

export async function analyzeResume(
    input: AnalyzeResumeInput,
): Promise<ResumeAnalysisRecord> {
    const resume = await findResumeById(
        input.resumeId,
        input.userId,
    );

    if (!resume) {
        throw new AppError(
            "ไม่พบ Resume",
            404,
            "RESUME_NOT_FOUND",
        );
    }

    const existingAnalysis =
        await findResumeAnalysis(
            input.resumeId,
            input.userId,
        );

    if (
        existingAnalysis?.status ===
        "COMPLETED" &&
        !input.force
    ) {
        return existingAnalysis;
    }

    if (
        existingAnalysis?.status ===
        "PROCESSING"
    ) {
        throw new AppError(
            "Resume นี้กำลังอยู่ระหว่างการวิเคราะห์",
            409,
            "RESUME_ANALYSIS_IN_PROGRESS",
        );
    }

    const allChunks =
        await findCompletedChunksByResumeId(
            input.resumeId,
            input.userId,
        );

    if (allChunks.length === 0) {
        throw new AppError(
            "Resume ยังไม่มี Chunk ที่พร้อมสำหรับวิเคราะห์",
            409,
            "RESUME_CHUNKS_NOT_READY",
        );
    }

    const selectedChunks =
        limitResumeContext(
            allChunks,
            env.resumeAnalysis
                .maxContextCharacters,
        );

    if (selectedChunks.length === 0) {
        throw new AppError(
            "ไม่มีข้อความ Resume ที่สามารถวิเคราะห์ได้",
            422,
            "EMPTY_RESUME_CONTEXT",
        );
    }

    await upsertAnalysisProcessing(
        input.resumeId,
        input.userId,
    );

    try {
        const prompt =
            buildResumeAnalysisPrompt(
                {
                    chunks: selectedChunks,
                    analysisType: "BASE",
                    jobDescription: null,
                },
                 env.resumeAnalysis.promptVersion,
            );

        console.log(
            "Gemini resume analysis request:",
            {
                resumeId: input.resumeId,
                model:
                    env.gemini.generationModel,
                totalChunks: allChunks.length,
                selectedChunks:
                    selectedChunks.length,
                promptLength: prompt.length,
            },
        );

        const response =
            await gemini.models.generateContent({
                model:
                    env.gemini.generationModel,

                contents: prompt,

                config: {
                    temperature: 0.1,
                    maxOutputTokens: 2_500,

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
            });

        const responseText =
            response.text?.trim();

        if (!responseText) {
            throw new AppError(
                "Gemini ไม่ได้ส่งผลวิเคราะห์กลับมา",
                502,
                "GEMINI_EMPTY_ANALYSIS_RESPONSE",
            );
        }

        let rawResult: unknown;

        try {
            rawResult = JSON.parse(
                responseText,
            );
        } catch {
            throw new AppError(
                "Gemini ส่งผลลัพธ์ที่ไม่ใช่ JSON",
                502,
                "GEMINI_INVALID_JSON_RESPONSE",
                {
                    responsePreview:
                        responseText.slice(0, 500),
                },
            );
        }

        const validationResult =
            resumeAnalysisResultSchema.safeParse(
                rawResult,
            );

        if (!validationResult.success) {
            throw new AppError(
                "รูปแบบผลวิเคราะห์จาก Gemini ไม่ถูกต้อง",
                502,
                "GEMINI_INVALID_ANALYSIS_RESPONSE",
                validationResult.error.flatten(),
            );
        }

        const analysisResult:
            ResumeAnalysisResult =
            validationResult.data;

        validateScoreTotal(analysisResult);

        await markAnalysisCompleted(
            input.resumeId,
            input.userId,
            analysisResult,
            env.gemini.generationModel,
            env.resumeAnalysis.promptVersion,
        );
        const completedAnalysis =
            await findResumeAnalysis(
                input.resumeId,
                input.userId,
            );

        if (!completedAnalysis) {
            throw new AppError(
                "ไม่พบผลวิเคราะห์หลังบันทึกข้อมูล",
                500,
                "ANALYSIS_RESULT_NOT_FOUND",
            );
        }

        return completedAnalysis;
    } catch (error) {
        const errorMessage =
            error instanceof Error
                ? error.message
                : "Unknown resume analysis error";

        await markAnalysisFailed(
            input.resumeId,
            input.userId,
            errorMessage,
        );

        if (error instanceof AppError) {
            throw error;
        }

        console.error(
            "========== GEMINI RESUME ANALYSIS ERROR ==========",
        );
        console.dir(error, {
            depth: null,
        });
        console.error(
            "==================================================",
        );

        const details =
            getGeminiErrorDetails(error);

        if (
            details.status === 401 ||
            details.status === 403
        ) {
            throw new AppError(
                "Gemini API Key ไม่ถูกต้องหรือไม่มีสิทธิ์ใช้โมเดล",
                502,
                "GEMINI_AUTHENTICATION_FAILED",
            );
        }

        if (details.status === 404) {
            throw new AppError(
                "ไม่พบ Gemini Model ที่กำหนด",
                502,
                "GEMINI_MODEL_NOT_FOUND",
            );
        }

        if (details.status === 429) {
            throw new AppError(
                "Gemini API เกินโควตาหรือ Rate Limit",
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
            "ไม่สามารถวิเคราะห์ Resume ได้",
            502,
            "GEMINI_ANALYSIS_FAILED",
        );
    }
}

export async function getResumeAnalysis(
    resumeId: number,
    userId: number,
): Promise<ResumeAnalysisRecord> {
    const resume = await findResumeById(
        resumeId,
        userId,
    );

    if (!resume) {
        throw new AppError(
            "ไม่พบ Resume",
            404,
            "RESUME_NOT_FOUND",
        );
    }

    const analysis =
        await findResumeAnalysis(
            resumeId,
            userId,
        );

    if (!analysis) {
        throw new AppError(
            "Resume นี้ยังไม่ได้รับการวิเคราะห์",
            404,
            "RESUME_ANALYSIS_NOT_FOUND",
        );
    }

    return analysis;
}