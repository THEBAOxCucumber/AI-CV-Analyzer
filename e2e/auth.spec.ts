import { expect, test } from "@playwright/test"

import { PASSWORD, deleteTestUser, newTestUser } from "./helpers.js"

/*
 * วงจรบัญชีครบ: สมัคร → เข้าสู่ระบบ → Dashboard → ลบบัญชี (ทุกขั้นผ่านหน้าเว็บ)
 */
test("register, sign in, and delete the account through the UI", async ({ page, request }) => {
  const user = newTestUser()

  try {
    await page.goto("/register")

    await expect(page.getByText("เว็บไซต์นี้เป็นส่วนหนึ่งของรายวิชา 02739499")).toBeVisible()

    await page.getByLabel("ชื่อ", { exact: true }).fill(user.firstName)
    await page.getByLabel("นามสกุล").fill(user.lastName)
    await page.getByLabel("อีเมล").fill(user.email)
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD)
    await page.getByLabel("ยืนยันรหัสผ่าน").fill(PASSWORD)

    // เกณฑ์รหัสผ่านติ๊กครบ 4 ข้อ
    await expect(page.locator(".password-rules__item--passed")).toHaveCount(4)

    await page.getByRole("button", { name: "สมัครสมาชิก" }).click()

    await expect(page).toHaveURL(/\/sign-in$/)
    await expect(page.getByRole("status")).toContainText("สมัครสมาชิกสำเร็จ")

    await page.getByLabel("อีเมล").fill(user.email)
    await page.getByLabel("รหัสผ่าน", { exact: true }).fill(PASSWORD)
    await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()

    await expect(page).toHaveURL(/\/dashboard$/)
    await expect(page.getByRole("heading", { level: 1 })).toContainText(user.firstName)

    // ลบบัญชีจากหน้าตั้งค่า
    await page.goto("/settings")
    await page.getByRole("button", { name: "ลบบัญชี" }).click()

    const dialog = page.getByRole("dialog")
    const confirm = dialog.getByRole("button", { name: "ลบบัญชีถาวร" })

    await expect(confirm).toBeDisabled()
    await dialog.getByLabel("รหัสผ่านปัจจุบัน").fill(PASSWORD)
    await dialog.getByLabel("พิมพ์อีเมลของคุณเพื่อยืนยัน").fill(user.email)
    await expect(confirm).toBeEnabled()
    await confirm.click()

    await expect(page).toHaveURL(/\/sign-in/)
    await expect(page.getByRole("status")).toContainText("ลบบัญชีและข้อมูลทั้งหมดของคุณเรียบร้อยแล้ว")

    // บัญชีหายจริง
    const login = await request.post("/api/auth/login", { data: { email: user.email, password: PASSWORD } })
    expect(login.status()).toBe(401)
  } finally {
    await deleteTestUser(request, user.email)
  }
})

test("shows an error for a wrong password", async ({ page }) => {
  await page.goto("/sign-in")

  await page.getByLabel("อีเมล").fill("nobody-e2e@test.local")
  await page.getByLabel("รหัสผ่าน", { exact: true }).fill("WrongPassword1")
  await page.getByRole("button", { name: "เข้าสู่ระบบ" }).click()

  await expect(page.getByRole("alert")).toContainText("อีเมลหรือรหัสผ่านไม่ถูกต้อง")
})

test("redirects to sign-in when not logged in", async ({ page }) => {
  await page.goto("/dashboard")

  await expect(page).toHaveURL(/\/sign-in$/)
})
