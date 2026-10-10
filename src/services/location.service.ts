/*
 * รายชื่อ 77 จังหวัด — เก็บไว้ในโปรเจกต์ (src/data/thai-provinces.json)
 * ไม่ดึงจากภายนอกตอนใช้งาน: ข้อมูลแทบไม่เปลี่ยน และต้นทางเคยเปลี่ยนรูปแบบจนหน้า Settings พัง
 *
 * ที่มา: https://github.com/kongvut/thai-province-data (api/latest/province.json)
 * อัปเดต: ดาวน์โหลดใหม่ แล้วแปลงเป็น { id, nameTh, nameEn } เรียงตามชื่อไทย
 */
export interface Province {
  id: number
  nameTh: string
  nameEn: string
}

let provincesCache:
  | Promise<Province[]>
  | null = null

/*
 * แยก chunk — โหลดเฉพาะตอนเปิดหน้าที่ใช้
 * ถ้า error (เช่น deploy ใหม่ chunk เก่าหาย) ล้าง cache ให้ลองใหม่ได้
 */
export function getThaiProvinces(): Promise<Province[]> {
  provincesCache ??=
    import("../data/thai-provinces.json")
      .then((module) => module.default)
      .catch((error: unknown) => {
        provincesCache = null
        throw error
      })

  return provincesCache
}
