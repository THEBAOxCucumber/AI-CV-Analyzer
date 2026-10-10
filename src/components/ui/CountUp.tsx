import {
  useCountUp,
} from "../../hooks/useCountUp"

/*
 * ตัวเลขนับขึ้น (ตัวเลขกว้างเท่ากันทุกหลัก)
 * screen reader อ่านค่าจริงเสมอ ไม่อ่านค่าระหว่างนับ
 */
export function CountUp({
  value,
}: {
  value: number
}) {
  const displayed = useCountUp(value)

  return (
    <>
      <span className="tabular-nums" aria-hidden="true">
        {displayed}
      </span>
      <span className="sr-only">{value}</span>
    </>
  )
}
