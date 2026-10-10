import {
  useEffect,
  useState,
} from "react"

function prefersReducedMotion(): boolean {
  return (
    typeof window !== "undefined" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  )
}

/*
 * นับตัวเลขจาก 0 → target (ease-out)
 * ผู้ใช้ตั้งค่าลดการเคลื่อนไหว → คืน target ทันที (ไม่ animate)
 */
export function useCountUp(
  target: number,
  durationMs = 900,
): number {
  const reduced = prefersReducedMotion()

  const [value, setValue] =
    useState(0)

  useEffect(() => {
    if (reduced) {
      return
    }

    let frame = 0

    /*
     * เริ่มนับจากเฟรมแรก ไม่ใช่ performance.now()
     * เวลาที่ rAF ส่งมาอาจเก่ากว่าตอนเรียก → progress ติดลบ → ตัวเลขติดลบแวบหนึ่ง
     */
    let startedAt: number | null = null

    function tick(now: number) {
      startedAt ??= now

      const progress = Math.min(1, (now - startedAt) / durationMs)
      // easeOutCubic
      const eased = 1 - (1 - progress) ** 3

      setValue(Math.round(target * eased))

      if (progress < 1) {
        frame = requestAnimationFrame(tick)
      }
    }

    frame = requestAnimationFrame(tick)

    return () => cancelAnimationFrame(frame)
  }, [target, durationMs, reduced])

  return reduced ? target : value
}
