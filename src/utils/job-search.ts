/*
 * ลิงก์ไปหน้าหางาน พร้อม Resume ที่เลือกไว้ และคำค้น (ถ้ามี)
 * เช่น /jobs?resume=12&q=Frontend+Developer
 */
export function buildJobSearchPath(
  resumeId: number,
  keywords?: string | null,
): string {
  const params = new URLSearchParams({
    resume: String(resumeId),
  })

  const query = keywords?.trim()

  if (query) {
    params.set("q", query)
  }

  return `/jobs?${params.toString()}`
}
