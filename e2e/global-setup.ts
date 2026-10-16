import { execFileSync } from "node:child_process"

/*
 * ล้างตัวนับ rate limit ของ IP ในเครื่อง (dev เท่านั้น) ก่อนรัน E2E
 *
 * เทสต์สมัคร/เข้าสู่ระบบหลายครั้งจาก IP เดียว → รันซ้ำติดกันจะชนเพดาน 30 ครั้ง/15 นาที
 * (ระบบป้องกันการเดารหัสผ่านทำงานถูกต้อง) — ล้างเฉพาะ key ของ loopback ใน environment development
 */
const CONTAINER = process.env.REDIS_CONTAINER ?? "resume-redis"
const PATTERNS = [
  "rate-limit:development:auth-ip:127.0.0.1",
  "rate-limit:development:auth-ip:::/56",
  "rate-limit:development:auth-ip:::1",
  "rate-limit:development:login:127.0.0.1:*",
]

export default function globalSetup(): void {
  try {
    let cleared = 0

    for (const pattern of PATTERNS) {
      const keys = execFileSync("docker", ["exec", CONTAINER, "redis-cli", "--scan", "--pattern", pattern], { encoding: "utf8" })
        .split("\n")
        .map((key) => key.trim())
        .filter(Boolean)

      if (keys.length > 0) {
        execFileSync("docker", ["exec", CONTAINER, "redis-cli", "del", ...keys])
        cleared += keys.length
      }
    }

    console.log(`[e2e] cleared ${cleared} local rate-limit keys`)
  } catch {
    console.warn("[e2e] could not reach Redis via docker — if logins fail with TOO_MANY_REQUESTS, wait 15 minutes")
  }
}
