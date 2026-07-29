import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import {
  createQueryEmbedding,
} from "../embedding/embedding-provider.service.js";
import {
  searchResumeVectors,
} from "../embedding/vector-store.service.js";
import {
  findResumeById,
} from "../resume/resume.repository.js";
import type {
  SemanticSearchInput,
  SemanticSearchResult,
} from "./semantic-search.types.js";

export async function semanticSearchResume(
  input: SemanticSearchInput,
): Promise<SemanticSearchResult[]> {
  const query = input.query.trim();

  if (!query) {
    throw new AppError(
      "กรุณาระบุคำถามหรือข้อความที่ต้องการค้นหา",
      400,
      "SEARCH_QUERY_REQUIRED",
    );
  }

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

  if (resume.chunking_status !== "COMPLETED") {
    throw new AppError(
      "Resume ยังแบ่ง Chunk ไม่สำเร็จ",
      409,
      "RESUME_CHUNKS_NOT_READY",
    );
  }

  const limit = Math.max(
    1,
    Math.min(
      Math.trunc(
        input.limit ??
          env.semanticSearch.defaultLimit,
      ),
      10,
    ),
  );

  const scoreThreshold =
    input.scoreThreshold ??
    env.semanticSearch.scoreThreshold;

  const queryEmbedding =
    await createQueryEmbedding(query);

  const results = await searchResumeVectors({
    vector: queryEmbedding.embedding,
    userId: input.userId,
    resumeId: input.resumeId,
    limit,
    scoreThreshold,
  });

  return results;
}