/*
 * รวมค่าฟอร์ม: ใช้ค่าจาก edited เฉพาะ fields ที่ระบุ ที่เหลือใช้จาก base
 *
 * หน้า Settings: กด Save การ์ดไหน → ส่งค่าที่แก้เฉพาะการ์ดนั้น
 * field ของการ์ดอื่นใช้ค่าที่บันทึกไว้ล่าสุด (ไม่บันทึกค่าที่แก้ค้างไว้ไปด้วย)
 */
export function mergeFields<T extends object>(
  base: T,
  edited: T,
  fields: ReadonlyArray<keyof T>,
): T {
  const result = { ...base }

  for (const field of fields) {
    result[field] = edited[field]
  }

  return result
}
