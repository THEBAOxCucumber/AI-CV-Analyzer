import { describe, expect, it } from "vitest"

import { formatFileSize } from "./file-size"
import { getOAuthErrorMessage } from "./oauth-errors"
import { formatSessionTime, getInitials } from "./session"

describe("formatFileSize", () => {
  it.each([
    [0, "0 B"],
    [1023, "1023 B"],
    [1024, "1.0 KB"],
    [1536, "1.5 KB"],
    [5 * 1024 * 1024, "5.0 MB"],
  ])("%i bytes → %s", (bytes, text) => {
    expect(formatFileSize(bytes)).toBe(text)
  })
})

describe("formatSessionTime", () => {
  it.each([
    [0, "00:00"],
    [59, "00:59"],
    [895, "14:55"],
    [3600, "60:00"],
  ])("%i วินาที → %s", (seconds, text) => {
    expect(formatSessionTime(seconds)).toBe(text)
  })
})

describe("getInitials", () => {
  it("ใช้ตัวแรกของชื่อและนามสกุล เป็นตัวพิมพ์ใหญ่", () => {
    expect(getInitials("preview", "user")).toBe("PU")
  })

  it("ไม่มีชื่อ → U", () => {
    expect(getInitials()).toBe("U")
  })
})

describe("getOAuthErrorMessage", () => {
  it("ไม่มีรหัส → null", () => {
    expect(getOAuthErrorMessage(null)).toBeNull()
  })

  it("รหัสที่รู้จัก → ข้อความเฉพาะ", () => {
    expect(getOAuthErrorMessage("OAUTH_CANCELLED")).toContain("ยกเลิก")
  })

  it("รหัสที่ไม่รู้จัก → ข้อความทั่วไป", () => {
    expect(getOAuthErrorMessage("SOMETHING_ELSE")).toContain("ไม่สำเร็จ")
  })
})
