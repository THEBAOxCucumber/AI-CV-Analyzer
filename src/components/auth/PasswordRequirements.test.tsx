import { describe, expect, it } from "vitest"
import { render, screen } from "@testing-library/react"

import { PasswordRequirements } from "./PasswordRequirements"

function passedRules(): string[] {
  return screen
    .getAllByRole("listitem")
    .filter((item) => item.classList.contains("password-rules__item--passed"))
    .map((item) => item.textContent ?? "")
}

describe("PasswordRequirements", () => {
  it("ยังไม่พิมพ์ → ไม่ผ่านสักข้อ และไม่แสดงระดับ", () => {
    const { container } = render(<PasswordRequirements password="" />)

    expect(passedRules()).toHaveLength(0)
    expect(container.querySelector(".password-rules")?.getAttribute("data-level")).toBe("0")
    expect(container.querySelector(".password-rules__meter em")).toBeNull()
  })

  it("ผ่านบางข้อ → ติ๊กเฉพาะข้อที่ผ่าน และบอกสถานะให้ screen reader", () => {
    const { container } = render(<PasswordRequirements password="Secret1" />)

    expect(passedRules()).toHaveLength(3)
    expect(screen.getByText("อย่างน้อย 8 ตัวอักษร").closest("li")?.textContent).toContain("(ยังไม่ผ่าน)")
    expect(container.querySelector(".password-rules")?.getAttribute("data-level")).toBe("3")
    expect(screen.getByText("ดี")).toBeTruthy()
  })

  it("ครบทุกข้อ → ระดับ 4 ครบถ้วน", () => {
    const { container } = render(<PasswordRequirements password="Secret123" />)

    expect(passedRules()).toHaveLength(4)
    expect(container.querySelectorAll(".password-rules__segment--on")).toHaveLength(4)
    expect(screen.getByText("ครบถ้วน")).toBeTruthy()
  })
})
