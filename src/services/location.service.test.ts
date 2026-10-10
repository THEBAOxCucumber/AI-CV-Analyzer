import { describe, expect, it } from "vitest"

import { getThaiProvinces } from "./location.service"

/*
 * กันไฟล์ src/data/thai-provinces.json เสีย / ถูกแก้ผิดรูปแบบ
 */
describe("getThaiProvinces", () => {
  it("มีครบ 77 จังหวัด ไม่ซ้ำ และเรียงตามชื่อไทย", async () => {
    const provinces = await getThaiProvinces()

    expect(provinces).toHaveLength(77)
    expect(new Set(provinces.map((province) => province.nameTh)).size).toBe(77)

    const sorted = [...provinces].sort((a, b) => a.nameTh.localeCompare(b.nameTh, "th"))
    expect(provinces).toEqual(sorted)
  })

  it("ทุกรายการมี id, ชื่อไทย และชื่ออังกฤษ", async () => {
    const provinces = await getThaiProvinces()

    for (const province of provinces) {
      expect(province).toEqual({
        id: expect.any(Number),
        nameTh: expect.stringMatching(/\S/),
        nameEn: expect.stringMatching(/\S/),
      })
    }

    expect(provinces.map((province) => province.nameTh)).toContain("กรุงเทพมหานคร")
  })
})
