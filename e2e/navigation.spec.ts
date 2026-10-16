import { expect, test } from "@playwright/test"

import { deleteTestUser, newTestUser, registerViaApi, signInAs } from "./helpers.js"

const user = newTestUser()

test.beforeAll(async ({ request }) => {
  await registerViaApi(request, user)
})

test.afterAll(async ({ request }) => {
  await deleteTestUser(request, user.email)
})

test("desktop: hamburger collapses the sidebar and remembers it", async ({ page, request, isMobile }) => {
  test.skip(isMobile, "desktop only")

  await signInAs(page, request, user.email)
  await page.evaluate(() => localStorage.removeItem("ai-cv-sidebar-collapsed"))
  await page.goto("/dashboard")

  const sidebar = page.locator("#app-sidebar")
  const collapse = page.getByRole("button", { name: "ย่อเมนู" })

  await expect(sidebar).toHaveCSS("width", "256px")
  await collapse.click()
  await expect(sidebar).toHaveClass(/sidebar--collapsed/)

  await page.reload()
  await expect(page.locator("#app-sidebar")).toHaveClass(/sidebar--collapsed/)

  await page.getByRole("button", { name: "ขยายเมนู" }).click()
  await expect(page.locator("#app-sidebar")).not.toHaveClass(/sidebar--collapsed/)
})

test("mobile: hamburger opens the drawer; close button, Esc and links close it @mobile", async ({ page, request, isMobile }) => {
  test.skip(!isMobile, "mobile only")

  await signInAs(page, request, user.email)
  await page.goto("/dashboard")

  const toggle = page.getByRole("button", { name: "เปิดเมนู", exact: true })
  const drawer = page.locator("#app-sidebar")

  await expect(drawer).toBeHidden()

  await toggle.click()
  await expect(drawer).toBeVisible()
  await expect(toggle).toHaveAttribute("aria-expanded", "true")
  await page.getByRole("button", { name: "ปิดเมนู", exact: true }).click()
  await expect(drawer).toBeHidden()
  await expect(toggle).toBeFocused()

  await toggle.click()
  await page.keyboard.press("Escape")
  await expect(drawer).toBeHidden()

  await toggle.click()
  await drawer.getByRole("link", { name: "ประวัติ" }).click()
  await expect(page).toHaveURL(/\/history$/)
  await expect(drawer).toBeHidden()
})

test("privacy page is public and shows the course notice @mobile", async ({ page }) => {
  await page.goto("/sign-in")
  await page.getByRole("link", { name: "นโยบายความเป็นส่วนตัว" }).click()

  await expect(page).toHaveURL(/\/privacy$/)
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("นโยบายความเป็นส่วนตัว")
  await expect(page.getByText("เว็บไซต์นี้เป็นส่วนหนึ่งของรายวิชา 02739499 Information Technology Project").first()).toBeVisible()

  await page.getByRole("navigation", { name: "สารบัญ" }).getByRole("link", { name: "ติดต่อเรา" }).click()
  await expect(page.getByRole("link", { name: "phiriyaporn.y@ku.th" })).toBeInViewport()
})
