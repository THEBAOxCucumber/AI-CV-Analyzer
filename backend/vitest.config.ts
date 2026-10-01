import {
  defineConfig,
} from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",

    setupFiles: [
      "./tests/setup.ts",
    ],

    testTimeout: 20_000,

    hookTimeout: 20_000,

    sequence: {
      concurrent: false,
    },

    /*
     * ทรัพยากรแยกจาก dev ทั้งหมด (ตั้งก่อน dotenv โหลด .env → .env ไม่ทับ)
     * สร้าง DB: npm run test:db:setup
     */
    env: {
      NODE_ENV: "test",

      DB_NAME:
        "ai_resume_analyzer_test",

      // id ใน DB เทสต์ชนกับ dev ได้ → ห้ามลบ vector ของผู้ใช้จริง
      QDRANT_COLLECTION:
        "resume_chunks_test",

      UPLOAD_DIR:
        "uploads/test",

      ANALYSIS_QUEUE_NAME:
        "resume-analysis-test",

      ANALYSIS_RETRY_DELAY_MS:
        "50",

      // เทสต์ยิง auth จาก IP เดียวหลายสิบครั้ง (login ผิดต่อ email ยังใช้ค่าจริง)
      RATE_LIMIT_AUTH_IP_MAX:
        "100000",
    },
  },
});