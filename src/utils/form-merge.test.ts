import { describe, expect, it } from "vitest"

import { mergeFields } from "./form-merge"

describe("mergeFields", () => {
  const saved = { phone: "0811111111", bio: "เดิม", major: "วิศวะ" }

  it("ใช้ค่าที่แก้เฉพาะ field ที่ระบุ — ค่าที่แก้ค้างในการ์ดอื่นไม่ติดไป", () => {
    const edited = { phone: "0822222222", bio: "ใหม่", major: "แก้ค้างไว้" }

    expect(mergeFields(saved, edited, ["phone", "bio"])).toEqual({
      phone: "0822222222",
      bio: "ใหม่",
      major: "วิศวะ",
    })
  })

  it("หลังบันทึก: อัปเดตการ์ดที่บันทึก แต่เก็บค่าที่แก้ค้างในการ์ดอื่นไว้", () => {
    const current = { phone: "0822222222", bio: "ใหม่", major: "แก้ค้างไว้" }
    const fromServer = { phone: "0822222222", bio: "ใหม่ (ตัดช่องว่างแล้ว)", major: "วิศวะ" }

    expect(mergeFields(current, fromServer, ["phone", "bio"])).toEqual({
      phone: "0822222222",
      bio: "ใหม่ (ตัดช่องว่างแล้ว)",
      major: "แก้ค้างไว้",
    })
  })

  it("ไม่แก้ object เดิม", () => {
    const base = { ...saved }

    mergeFields(base, { ...saved, bio: "x" }, ["bio"])

    expect(base).toEqual(saved)
  })
})
