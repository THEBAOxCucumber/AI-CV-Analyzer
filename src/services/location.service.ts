/*
 * รายชื่อจังหวัดจาก open data
 * https://github.com/kongvut/thai-province-data
 */
const PROVINCES_URL =
  "https://raw.githubusercontent.com/kongvut/thai-province-data/master/api/latest/province.json"

const REQUEST_TIMEOUT_MS = 10_000

export interface Province {
  id: number
  nameTh: string
  nameEn: string
}

interface RawProvince {
  id?: unknown
  name_th?: unknown
  name_en?: unknown
  deleted_at?: unknown
}

let provincesCache:
  | Promise<Province[]>
  | null = null

/*
 * ข้อมูลภายนอก: ตรวจรูปร่างก่อนใช้
 */
function toProvince(
  item: RawProvince,
): Province | null {
  if (
    typeof item.id !== "number" ||
    typeof item.name_th !== "string" ||
    typeof item.name_en !== "string" ||
    item.deleted_at != null
  ) {
    return null
  }

  return {
    id: item.id,
    nameTh: item.name_th.trim(),
    nameEn: item.name_en.trim(),
  }
}

async function fetchProvinces(): Promise<Province[]> {
  const response = await fetch(
    PROVINCES_URL,
    {
      signal: AbortSignal.timeout(
        REQUEST_TIMEOUT_MS,
      ),
    },
  )

  if (!response.ok) {
    throw new Error(
      `Province API request failed: ${response.status}`,
    )
  }

  const data: unknown =
    await response.json()

  if (!Array.isArray(data)) {
    throw new Error(
      "Province API returned invalid data",
    )
  }

  const provinces = data
    .map((item) =>
      typeof item === "object" &&
      item !== null
        ? toProvince(item as RawProvince)
        : null,
    )
    .filter(
      (province): province is Province =>
        province !== null,
    )
    .sort((a, b) =>
      a.nameTh.localeCompare(
        b.nameTh,
        "th",
      ),
    )

  if (provinces.length === 0) {
    throw new Error(
      "Province API returned no provinces",
    )
  }

  return provinces
}

/*
 * ดึงครั้งเดียวต่อการเปิดแอป
 * ถ้า error ล้าง cache ให้ลองใหม่ได้
 */
export function getThaiProvinces(): Promise<Province[]> {
  provincesCache ??=
    fetchProvinces().catch((error: unknown) => {
      provincesCache = null
      throw error
    })

  return provincesCache
}
