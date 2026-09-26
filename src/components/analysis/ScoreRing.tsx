/*
 * วงแหวนคะแนน 0–100
 * track จาง + ส่วนที่ได้เป็น navy (สีเดียว)
 */
const SIZE = 136
const STROKE = 12
const RADIUS = (SIZE - STROKE) / 2
const CIRCUMFERENCE = 2 * Math.PI * RADIUS

export function ScoreRing({
  score,
  max = 100,
}: {
  score: number | null
  max?: number
}) {
  const ratio =
    score === null
      ? 0
      : Math.min(1, Math.max(0, score / max))

  return (
    <div
      className="score-ring-gauge"
      role="img"
      aria-label={
        score === null
          ? "ไม่มีคะแนน"
          : `คะแนน ${score} จาก ${max}`
      }
    >
      <svg
        viewBox={`0 0 ${SIZE} ${SIZE}`}
        aria-hidden="true"
      >
        <circle
          className="score-ring-gauge__track"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
        />

        <circle
          className="score-ring-gauge__value"
          cx={SIZE / 2}
          cy={SIZE / 2}
          r={RADIUS}
          strokeWidth={STROKE}
          strokeDasharray={CIRCUMFERENCE}
          strokeDashoffset={
            CIRCUMFERENCE * (1 - ratio)
          }
          transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
        />
      </svg>

      <div className="score-ring-gauge__label">
        <strong>
          {score ?? "—"}
        </strong>

        {score !== null && (
          <span>/{max}</span>
        )}
      </div>
    </div>
  )
}
