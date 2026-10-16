import { defineConfig, devices } from "@playwright/test"

/*
 * E2E: ทดสอบเหมือนผู้ใช้จริง กับระบบที่รันอยู่ในเครื่อง
 *
 * ต้องเปิดก่อน: Docker (MySQL/Redis/Qdrant), Ollama, backend (npm run dev ใน backend/)
 * และ frontend (npm run dev) — แล้วรัน npm run test:e2e
 *
 * - ใช้ Edge ที่ติดตั้งในเครื่อง (ไม่ต้องดาวน์โหลดเบราว์เซอร์)
 * - workers 1: ใช้ DB เดียวกัน + rate limit ต่อ IP
 * - บัญชีทดสอบ tmp-e2e-*@test.local ถูกลบท้ายทุกเทสต์ (ผ่าน API ลบบัญชี)
 * - ไม่อยู่ใน CI (ต้องมี Ollama + GPU)
 */
export default defineConfig({
  testDir: "./e2e",
  globalSetup: "./e2e/global-setup.ts",
  fullyParallel: false,
  workers: 1,
  retries: 0,
  timeout: 60_000,
  expect: { timeout: 10_000 },
  reporter: [["list"], ["html", { open: "never", outputFolder: "e2e-report" }]],

  use: {
    baseURL: process.env.E2E_BASE_URL ?? "http://localhost:5173",
    channel: "msedge",
    locale: "th-TH",
    timezoneId: "Asia/Bangkok",
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },

  projects: [
    {
      name: "desktop",
      use: { ...devices["Desktop Edge"], channel: "msedge" },
    },
    {
      name: "mobile",
      use: { ...devices["Pixel 7"], channel: "msedge" },
      // มือถือ: เฉพาะเทสต์ที่ติดแท็ก @mobile
      grep: /@mobile/,
    },
  ],
})
