import {
  useState,
} from "react"

import {
  useAuth,
} from "./useAuth"

/*
 * ปุ่มต่ออายุเซสชัน (ตัวนับเวลาใน Sidebar / แถบบนมือถือ)
 * กันกดซ้ำระหว่างรอ — 401 ออกจากระบบให้แล้วใน AuthProvider
 */
export function useExtendSession() {
  const { extendSession } = useAuth()

  const [isExtending, setIsExtending] =
    useState(false)

  async function handleExtendSession() {
    if (isExtending) {
      return
    }

    setIsExtending(true)

    try {
      await extendSession()
    } catch {
      /* เครือข่ายล่ม ฯลฯ → เวลาเดิมยังนับต่อ กดใหม่ได้ */
    } finally {
      setIsExtending(false)
    }
  }

  return {
    isExtending,
    handleExtendSession,
  }
}
