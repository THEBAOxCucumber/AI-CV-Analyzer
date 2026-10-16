import { expect, type APIRequestContext, type Page } from "@playwright/test"

export const PASSWORD = "TestPassword123!"

export interface TestUser {
  email: string
  firstName: string
  lastName: string
}

export function newTestUser(): TestUser {
  return {
    email: `tmp-e2e-${Date.now()}-${Math.floor(Math.random() * 1e6)}@test.local`,
    firstName: "ทดสอบ",
    lastName: "อีทูอี",
  }
}

export async function registerViaApi(request: APIRequestContext, user: TestUser): Promise<void> {
  const response = await request.post("/api/auth/register", {
    data: { ...user, password: PASSWORD },
  })

  expect(response.status(), await response.text()).toBe(201)
}

/*
 * จำ token ต่อบัญชีในการรันครั้งนี้ — ลดจำนวนครั้งเข้าสู่ระบบ (มี rate limit ต่อ IP)
 */
const tokens = new Map<string, string>()

export async function loginToken(request: APIRequestContext, email: string): Promise<string | null> {
  const cached = tokens.get(email)
  if (cached) return cached

  const response = await request.post("/api/auth/login", {
    data: { email, password: PASSWORD },
  })

  if (!response.ok()) return null

  const token = (await response.json()).data.token as string
  tokens.set(email, token)
  return token
}

/*
 * เข้าสู่ระบบโดยตั้ง token (เร็วกว่ากรอกฟอร์ม — เทสต์ฟอร์มจริงอยู่ใน auth.spec)
 */
export async function signInAs(page: Page, request: APIRequestContext, email: string): Promise<void> {
  const token = await loginToken(request, email)
  expect(token, "login failed").toBeTruthy()

  await page.goto("/sign-in")
  await page.evaluate((value) => localStorage.setItem("ai-cv-analyzer-token", value), token as string)
}

/*
 * ลบบัญชีทดสอบ (ผ่าน API ลบบัญชี — ลบไฟล์ / vector / ผลวิเคราะห์ด้วย) — ไม่มีบัญชีแล้วก็ไม่เป็นไร
 */
export async function deleteTestUser(request: APIRequestContext, email: string): Promise<void> {
  const token = await loginToken(request, email)
  if (!token) return

  tokens.delete(email)

  await request.delete("/api/auth/account", {
    headers: { Authorization: `Bearer ${token}` },
    data: { currentPassword: PASSWORD, confirmEmail: email },
  })
}

export async function setTheme(page: Page, theme: "light" | "dark"): Promise<void> {
  await page.evaluate((value) => localStorage.setItem("ai-cv-analyzer-theme", value), theme)
}
