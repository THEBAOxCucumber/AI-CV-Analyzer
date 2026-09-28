import {
  useCallback,
  useSyncExternalStore,
} from "react"

import {
  type ResolvedTheme,
  type Theme,
  getSystemPrefersDark,
  getTheme,
  setTheme as saveTheme,
  subscribeTheme,
} from "../utils/appearance"

/*
 * ธีมปัจจุบัน + สลับธีม
 * ทุก component ที่ใช้ hook นี้ sync กันเอง
 */
export function useTheme(): {
  theme: Theme
  resolvedTheme: ResolvedTheme
  setTheme: (theme: Theme) => void
  toggleTheme: () => void
} {
  const theme = useSyncExternalStore(
    subscribeTheme,
    getTheme,
  )

  const prefersDark = useSyncExternalStore(
    subscribeTheme,
    getSystemPrefersDark,
  )

  const resolvedTheme: ResolvedTheme =
    theme === "system"
      ? prefersDark
        ? "dark"
        : "light"
      : theme

  /*
   * ปุ่มสลับด่วน: สลับจากที่เห็นอยู่ แล้วจำเป็นค่าที่เลือก
   */
  const toggleTheme = useCallback(() => {
    saveTheme(
      resolvedTheme === "dark"
        ? "light"
        : "dark",
    )
  }, [resolvedTheme])

  return {
    theme,
    resolvedTheme,
    setTheme: saveTheme,
    toggleTheme,
  }
}
