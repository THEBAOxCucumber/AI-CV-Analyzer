/*
 * กฎรหัสผ่านเดียวกับ backend (passwordSchema ใน auth.validation.ts)
 * คืนข้อความผิดพลาด หรือ null ถ้าผ่าน
 */
export function validateNewPassword(
  password: string,
  confirmPassword: string,
): string | null {
  if (!password || !confirmPassword) {
    return "กรุณากรอกรหัสผ่านให้ครบทั้งสองช่อง"
  }

  if (password.length < 8) {
    return "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร"
  }

  if (!/[A-Z]/.test(password)) {
    return "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวใหญ่อย่างน้อย 1 ตัว"
  }

  if (!/[a-z]/.test(password)) {
    return "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวเล็กอย่างน้อย 1 ตัว"
  }

  if (!/\d/.test(password)) {
    return "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว"
  }

  if (password !== confirmPassword) {
    return "รหัสผ่านไม่ตรงกัน"
  }

  return null
}
