import { afterEach } from "vitest"
import { cleanup } from "@testing-library/react"

/*
 * ไม่ได้เปิด globals ของ Vitest → Testing Library ล้าง DOM เองไม่ได้
 * ล้างหลังทุกเทสต์ ไม่ให้ component จากเทสต์ก่อนค้างอยู่
 */
afterEach(() => {
  cleanup()
})
