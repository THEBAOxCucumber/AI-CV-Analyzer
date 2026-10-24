import {
  Link,
} from "react-router-dom"

/*
 * ท้ายการ์ดหน้า Sign in / Register: ลิงก์นโยบาย + ข้อความรายวิชา
 */
export function AuthLegalNote() {
  return (
    <p className="auth-legal">
      <Link to="/privacy">นโยบายความเป็นส่วนตัว</Link>
      <span aria-hidden="true"> · </span>{"เว็บไซต์นี้เป็นส่วนหนึ่งของรายวิชา 02739499 Information Technology Project"}
    </p>
  )
}
