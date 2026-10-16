import AxeBuilder from "@axe-core/playwright"
import { expect, test, type Page } from "@playwright/test"

import { setTheme } from "./helpers.js"

/*
 * ตรวจการเข้าถึง (WCAG 2.1 A/AA) ด้วย axe ทุกหน้า × 2 ธีม
 * หน้าที่ต้องล็อกอินใช้บัญชีสาธิต (npm run demo:seed) — ไม่มีบัญชีสาธิตจะข้าม
 */
const DEMO_EMAIL = process.env.DEMO_EMAIL ?? "demo@example.com"
const DEMO_PASSWORD = process.env.DEMO_PASSWORD ?? "Demo12345"

const PUBLIC_PAGES = ["/sign-in", "/register", "/forgot-password", "/privacy"]
const APP_PAGES = ["/dashboard", "/resumes/upload", "/history", "/insights", "/settings"]

/*
 * axe คำนวณ contrast บนพื้นไล่สีไม่ได้ (จัดเป็น "incomplete" ไม่ใช่ violation)
 * → ระหว่างตรวจ แทนพื้นไล่สีด้วยสีทึบ "กรณีแย่สุด" ของแต่ละธีม
 *   สว่าง: จุดที่เข้มที่สุดของ gradient (ตัวอักษรเข้ม) / มืด: จุดที่สว่างที่สุด (ตัวอักษรสว่าง)
 * การ์ดกระจกโปร่งแสง axe ผสมสีให้เอง → ผ่านกรณีแย่สุด = ผ่านทุกจุดของพื้นจริง
 */
const WORST_CASE_BACKGROUND = { light: "#d8e2f6", dark: "#272a56" }

async function scan(page: Page, label: string, theme: "light" | "dark") {
  // รอ animation / ข้อมูลโหลดเสร็จ — สีระหว่าง fade-in ทำให้วัด contrast ผิด
  await page.waitForLoadState("networkidle")
  await page.waitForTimeout(800)

  await page.addStyleTag({
    content: `
      html, body { background: ${WORST_CASE_BACKGROUND[theme]} !important; }
      :root, :root[data-theme] {
        --gradient-accent: ${WORST_CASE_BACKGROUND[theme]};
        --gradient-accent-soft: ${WORST_CASE_BACKGROUND[theme]};
      }
    `,
  })

  const results = await new AxeBuilder({ page })
    .withTags(["wcag2a", "wcag2aa", "wcag21a", "wcag21aa"])
    .analyze()

  const summary = results.violations.map((violation) =>
    `${violation.id} (${violation.impact}) ×${violation.nodes.length}: ${violation.help}\n` +
    violation.nodes.slice(0, 3).map((node) => `    ${node.target.join(" ")} — ${node.failureSummary?.split("\n")[1]?.trim() ?? ""}`).join("\n"),
  )

  expect(summary, `${label}\n${summary.join("\n")}`).toEqual([])
}

for (const theme of ["light", "dark"] as const) {
  test.describe(`${theme} theme`, () => {
    for (const path of PUBLIC_PAGES) {
      test(`public ${path}`, async ({ page }) => {
        await page.goto("/sign-in")
        await page.evaluate(() => localStorage.clear())
        await setTheme(page, theme)
        await page.goto(path)

        await scan(page, `${theme} ${path}`, theme)
      })
    }

    test.describe("signed in (demo account)", () => {
      let token: string | null = null

      test.beforeAll(async ({ request }) => {
        const response = await request.post("/api/auth/login", { data: { email: DEMO_EMAIL, password: DEMO_PASSWORD } })
        token = response.ok() ? (await response.json()).data.token : null
      })

      test.beforeEach(async ({ page }) => {
        test.skip(!token, "no demo account — run npm run demo:seed")

        await page.goto("/sign-in")
        await page.evaluate((value) => localStorage.setItem("ai-cv-analyzer-token", value), token as string)
        await setTheme(page, theme)
      })

      for (const path of APP_PAGES) {
        test(`app ${path}`, async ({ page }) => {
          await page.goto(path)
          await scan(page, `${theme} ${path}`, theme)
        })
      }

      test("app analysis results (base + job match)", async ({ page, request }) => {
        const auth = { Authorization: `Bearer ${token}` }
        const resumes = (await (await request.get("/api/resumes", { headers: auth })).json()).data.resumes
        const history = (await (await request.get(`/api/resumes/${resumes[0].id}/analyses`, { headers: auth })).json()).data.analyses

        for (const type of ["BASE", "JOB_MATCH"]) {
          const run = history.find((item: { analysisType: string; status: string }) => item.analysisType === type && item.status === "COMPLETED")
          expect(run, `demo account has a ${type} analysis`).toBeTruthy()

          await page.goto(`/analyses/${run.id}`)
          await scan(page, `${theme} /analyses (${type})`, theme)
        }
      })
    })
  })
}
