// สร้าง vector ของ Resume ทั้งหมดใหม่ ด้วยการตั้งค่า Embedding ปัจจุบัน (EMBEDDING_* / QDRANT_COLLECTION)
//
// ใช้เมื่อเปลี่ยนโมเดล Embedding (เช่น Gemini → Ollama): ตั้ง QDRANT_COLLECTION ชื่อใหม่ก่อน
//   npm run embeddings:rebuild
//
// - ไม่แตะ collection เดิม → เปลี่ยนค่ากลับได้ทันที
// - รันซ้ำได้: chunk ที่ล้มเหลว/ค้างจะถูกทำใหม่
import type { RowDataPacket } from "mysql2";

import { database } from "../src/config/database.js";
import { env } from "../src/config/env.js";
import { redisConnection } from "../src/config/redis.js";
import { embedPendingResumeChunks } from "../src/modules/embedding/resume-embedding.service.js";
import { rateLimitRedis } from "../src/middleware/rate-limit.middleware.js";

const [resumes] = await database.execute<(RowDataPacket & { resume_id: number; user_id: number; chunks: number })[]>(
  `
    SELECT resume_id, user_id, COUNT(*) AS chunks
    FROM resume_chunks
    GROUP BY resume_id, user_id
    ORDER BY resume_id
  `,
);

console.log(
  `Rebuild ${resumes.length} resumes → ${env.embedding.provider}:${env.embedding.model} (${env.embedding.dimensions}d) in "${env.qdrant.collection}"`,
);

let failed = 0;
const started = Date.now();

for (const resume of resumes) {
  await database.execute(
    `
      UPDATE resume_chunks
      SET embedding_status = 'PENDING',
          vector_point_id = NULL,
          embedding_error = NULL
      WHERE resume_id = ? AND user_id = ?
    `,
    [resume.resume_id, resume.user_id],
  );

  try {
    let remaining = Number(resume.chunks);

    // ทีละ batch จนหมด
    while (remaining > 0) {
      const result = await embedPendingResumeChunks(resume.resume_id, resume.user_id);
      remaining = result.remainingPendingCount;

      if (result.processedCount === 0) break;
    }

    console.log(`  resume ${resume.resume_id}: ${resume.chunks} chunks ok`);
  } catch (error) {
    failed += 1;
    console.error(`  resume ${resume.resume_id}: FAILED —`, error instanceof Error ? error.message : error);
  }
}

console.log(`Done in ${((Date.now() - started) / 1000).toFixed(1)}s — ${resumes.length - failed} ok, ${failed} failed`);

await database.end();
await redisConnection.quit();
await rateLimitRedis.quit();

process.exit(failed > 0 ? 1 : 0);
