/*
 * เตือนเมื่อ session เหลือน้อยกว่านี้ (วินาที)
 */
export const SESSION_WARNING_SECONDS = 120

export function formatSessionTime(
  totalSeconds: number,
): string {
  const minutes =
    Math.floor(totalSeconds / 60)

  const seconds =
    totalSeconds % 60

  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`
}

export function getInitials(
  firstName?: string,
  lastName?: string,
): string {
  return [firstName?.[0], lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U"
}
