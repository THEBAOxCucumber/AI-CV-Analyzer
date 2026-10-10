import { describe, expect, it } from "vitest"

import { validateNewPassword } from "./password"

describe("validateNewPassword", () => {
  it("ผ่านเมื่อครบทุกกฎและยืนยันตรงกัน", () => {
    expect(validateNewPassword("Secret123", "Secret123")).toBeNull()
  })

  it.each([
    ["", "", "กรุณากรอกรหัสผ่านให้ครบทั้งสองช่อง"],
    ["Sec1", "Sec1", "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"],
    ["secret123", "secret123", "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวใหญ่อย่างน้อย 1 ตัว"],
    ["SECRET123", "SECRET123", "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวเล็กอย่างน้อย 1 ตัว"],
    ["SecretPass", "SecretPass", "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว"],
    ["Secret123", "Secret124", "รหัสผ่านไม่ตรงกัน"],
  ])("%j / %j → %s", (password, confirm, message) => {
    expect(validateNewPassword(password, confirm)).toBe(message)
  })
})
