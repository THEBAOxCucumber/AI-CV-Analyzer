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

/*
 * Theme (Settings → Appearance + ปุ่มสลับด่วน)
 * light / dark → ใส่ data-theme บน <html>
 * system       → ลบ data-theme ให้ CSS ใช้ prefers-color-scheme
 *
 * key นี้ index.html อ่านก่อน render ด้วย (กันจอขาวแวบ)
 */
export type Theme =
  | "light"
  | "dark"
  | "system"

export type ResolvedTheme =
  | "light"
  | "dark"

const THEME_KEY =
  "ai-cv-analyzer-theme"

export const THEME_CHANGE_EVENT =
  "ai-cv-analyzer:themechange"

const DARK_QUERY =
  "(prefers-color-scheme: dark)"

function isTheme(
  value: unknown,
): value is Theme {
  return (
    value === "light" ||
    value === "dark" ||
    value === "system"
  )
}

export function getTheme(): Theme {
  try {
    const stored =
      localStorage.getItem(THEME_KEY)

    return isTheme(stored)
      ? stored
      : "system"
  } catch {
    return "system"
  }
}

export function getSystemPrefersDark(): boolean {
  return window.matchMedia(DARK_QUERY).matches
}

export function resolveTheme(
  theme: Theme,
): ResolvedTheme {
  if (theme === "system") {
    return getSystemPrefersDark()
      ? "dark"
      : "light"
  }

  return theme
}

export function applyTheme(
  theme: Theme,
): void {
  const root = document.documentElement

  if (theme === "system") {
    root.removeAttribute("data-theme")
  } else {
    root.setAttribute("data-theme", theme)
  }
}

export function setTheme(
  theme: Theme,
): void {
  applyTheme(theme)

  try {
    localStorage.setItem(
      THEME_KEY,
      theme,
    )
  } catch {
    /*
     * ใช้ได้เฉพาะ session นี้
     */
  }

  window.dispatchEvent(
    new Event(THEME_CHANGE_EVENT),
  )
}

/*
 * ใช้กับ useSyncExternalStore
 * แจ้งเมื่อ: ผู้ใช้เปลี่ยนธีม / OS เปลี่ยนโหมด / แท็บอื่นเปลี่ยน
 */
export function subscribeTheme(
  onChange: () => void,
): () => void {
  const media =
    window.matchMedia(DARK_QUERY)

  function handleStorage(
    event: StorageEvent,
  ) {
    if (event.key === THEME_KEY) {
      applyTheme(getTheme())
      onChange()
    }
  }

  window.addEventListener(
    THEME_CHANGE_EVENT,
    onChange,
  )
  window.addEventListener(
    "storage",
    handleStorage,
  )
  media.addEventListener(
    "change",
    onChange,
  )

  return () => {
    window.removeEventListener(
      THEME_CHANGE_EVENT,
      onChange,
    )
    window.removeEventListener(
      "storage",
      handleStorage,
    )
    media.removeEventListener(
      "change",
      onChange,
    )
  }
}
