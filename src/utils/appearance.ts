/*
 * Font Size (Settings → Appearance)
 * ปรับ font-size ของ <html>
 * token ที่เป็น rem จะปรับตามทั้งแอป
 */
export type FontSize =
  | "small"
  | "medium"
  | "large"

const FONT_SIZE_KEY =
  "ai-cv-analyzer-font-size"

const ROOT_FONT_SIZE: Record<FontSize, string> = {
  small: "15px",
  medium: "16px",
  large: "18px",
}

function isFontSize(
  value: unknown,
): value is FontSize {
  return (
    value === "small" ||
    value === "medium" ||
    value === "large"
  )
}

export function getFontSize(): FontSize {
  try {
    const stored =
      localStorage.getItem(FONT_SIZE_KEY)

    return isFontSize(stored)
      ? stored
      : "medium"
  } catch {
    return "medium"
  }
}

export function applyFontSize(
  size: FontSize,
): void {
  document.documentElement.style.fontSize =
    ROOT_FONT_SIZE[size]
}

export function setFontSize(
  size: FontSize,
): void {
  applyFontSize(size)

  try {
    localStorage.setItem(
      FONT_SIZE_KEY,
      size,
    )
  } catch {
    /*
     * private mode / storage ถูกปิด
     * ใช้ได้เฉพาะ session นี้
     */
  }
}
