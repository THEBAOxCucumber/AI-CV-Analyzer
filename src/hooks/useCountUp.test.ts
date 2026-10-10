import { afterEach, describe, expect, it, vi } from "vitest"
import { renderHook, waitFor } from "@testing-library/react"

import { useCountUp } from "./useCountUp"

function mockReducedMotion(reduced: boolean) {
  vi.stubGlobal(
    "matchMedia",
    vi.fn((query: string) => ({
      matches: reduced && query.includes("reduce"),
      media: query,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
    })),
  )
}

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("useCountUp", () => {
  it("ผู้ใช้ตั้งค่าลดการเคลื่อนไหว → ได้ค่าจริงทันที", () => {
    mockReducedMotion(true)

    const { result } = renderHook(() => useCountUp(87))

    expect(result.current).toBe(87)
  })

  it("ปกติ → เริ่มจาก 0 แล้วนับขึ้นจนถึงค่าจริง", async () => {
    mockReducedMotion(false)

    const { result } = renderHook(() => useCountUp(87, 50))

    expect(result.current).toBe(0)
    await waitFor(() => expect(result.current).toBe(87))
  })

  it("เปลี่ยนค่าเป้าหมาย → นับไปยังค่าใหม่", async () => {
    mockReducedMotion(false)

    const { result, rerender } = renderHook(
      ({ target }) => useCountUp(target, 50),
      { initialProps: { target: 40 } },
    )

    await waitFor(() => expect(result.current).toBe(40))

    rerender({ target: 90 })

    await waitFor(() => expect(result.current).toBe(90))
  })
})
