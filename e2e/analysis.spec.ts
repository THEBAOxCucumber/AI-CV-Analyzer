import path from "node:path"

import { expect, test } from "@playwright/test"

import { deleteTestUser, newTestUser, registerViaApi, signInAs } from "./helpers.js"

/*
 * เส้นทางหลักของระบบ: อัปโหลด PDF → AI วิเคราะห์จริง (Ollama) → ดูผล → ประวัติ
 * ช้า (~30–60 วินาทีแล้วแต่ GPU) — ข้ามได้ด้วย E2E_SKIP_AI=1
 */
test.skip(process.env.E2E_SKIP_AI === "1", "AI analysis disabled")

test("upload a resume, analyze it with AI, and see the result", async ({ page, request }) => {
  test.setTimeout(300_000)

  const user = newTestUser()
  await registerViaApi(request, user)

  try {
    await signInAs(page, request, user.email)
    await page.goto("/resumes/upload")

    await page.locator('input[type="file"]').setInputFiles(
      path.resolve("backend/demo/demo-resume-backend.pdf"),
    )
    await expect(page.getByText("demo-resume-backend.pdf")).toBeVisible()

    await page.getByRole("button", { name: "อัปโหลด Resume" }).click()
    await expect(page.getByText("Resume พร้อมสำหรับ")).toBeVisible({ timeout: 60_000 })

    await page.getByRole("button", { name: "วิเคราะห์ Resume" }).click()

    // หน้าระหว่างวิเคราะห์ → หน้าผล
    await expect(page).toHaveURL(/\/analyses\/\d+$/, { timeout: 60_000 })
    await expect(page.getByRole("heading", { name: "ผลการวิเคราะห์" })).toBeVisible({ timeout: 240_000 })

    const score = page.getByRole("img", { name: /^คะแนน \d+ จาก 100$/ })
    await expect(score).toBeVisible()
    await expect(page.getByRole("heading", { name: "คำแนะนำ" })).toBeVisible()

    // ปรากฏในประวัติ
    await page.goto("/history")
    await expect(page.getByText("demo-resume-backend.pdf")).toBeVisible()
    await expect(page.getByText("สำเร็จ")).toBeVisible()
  } catch (error) {
    // เก็บสถานะงานวิเคราะห์ไว้ก่อนลบบัญชี — ไม่งั้นหาสาเหตุไม่ได้ (ข้อมูลถูกลบไปพร้อมบัญชี)
    const token = await page.evaluate(() => localStorage.getItem("ai-cv-analyzer-token")).catch(() => null)

    if (token) {
      const auth = { Authorization: `Bearer ${token}` }
      const resumes = await (await request.get("/api/resumes", { headers: auth })).json().catch(() => null)
      const runs = []

      for (const resume of resumes?.data?.resumes ?? []) {
        const history = await (await request.get(`/api/resumes/${resume.id}/analyses`, { headers: auth })).json().catch(() => null)
        runs.push(...(history?.data?.analyses ?? []).map((run: Record<string, unknown>) => ({
          id: run.id, status: run.status, errorCode: run.errorCode, attemptCount: run.attemptCount,
          createdAt: run.createdAt, updatedAt: run.updatedAt,
        })))
      }

      await test.info().attach("analysis-runs.json", {
        body: JSON.stringify({ resumes: resumes?.data?.resumes?.map((r: Record<string, unknown>) => ({ id: r.id, status: r.status })), runs }, null, 2),
        contentType: "application/json",
      })
      console.log("[analysis.spec] runs at failure:", JSON.stringify(runs))
    }

    throw error
  } finally {
    await deleteTestUser(request, user.email)
  }
})
