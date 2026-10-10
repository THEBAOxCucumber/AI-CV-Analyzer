import {
  Check,
  Circle,
} from "lucide-react"

/*
 * กฎรหัสผ่าน — ตรงกับ backend (8–72 ตัว, ใหญ่ / เล็ก / ตัวเลข)
 * ติ๊กถูกทีละข้อตามที่พิมพ์ + แถบความครบถ้วน
 */
const RULES: Array<{
  label: string
  test: (password: string) => boolean
}> = [
  { label: "อย่างน้อย 8 ตัวอักษร", test: (password) => password.length >= 8 },
  { label: "ตัวพิมพ์ใหญ่ (A–Z)", test: (password) => /[A-Z]/.test(password) },
  { label: "ตัวพิมพ์เล็ก (a–z)", test: (password) => /[a-z]/.test(password) },
  { label: "ตัวเลข (0–9)", test: (password) => /\d/.test(password) },
]

const LEVEL_LABELS = ["", "อ่อน", "พอใช้", "ดี", "ครบถ้วน"]

export function PasswordRequirements({
  password,
}: {
  password: string
}) {
  const results = RULES.map((rule) => ({
    label: rule.label,
    passed: rule.test(password),
  }))

  const passedCount =
    results.filter((result) => result.passed).length

  return (
    <div
      className="password-rules"
      data-level={password ? passedCount : 0}
    >
      <div className="password-rules__meter" aria-hidden="true">
        {RULES.map((rule, index) => (
          <span
            key={rule.label}
            className={
              index < passedCount && password
                ? "password-rules__segment password-rules__segment--on"
                : "password-rules__segment"
            }
          />
        ))}

        {password && (
          <em>{LEVEL_LABELS[passedCount]}</em>
        )}
      </div>

      <ul className="password-rules__list">
        {results.map((result) => (
          <li
            key={result.label}
            className={
              result.passed
                ? "password-rules__item password-rules__item--passed"
                : "password-rules__item"
            }
          >
            {result.passed
              ? <Check size={14} aria-hidden="true" />
              : <Circle size={14} aria-hidden="true" />}

            {result.label}

            <span className="sr-only">
              {result.passed ? " (ผ่าน)" : " (ยังไม่ผ่าน)"}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
