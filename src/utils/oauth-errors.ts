/*
 * ข้อความเมื่อกลับมาจาก Google ไม่สำเร็จ (?oauthError=…)
 */
const OAUTH_ERROR_MESSAGES: Record<string, string> = {
  OAUTH_CANCELLED:
    "ยกเลิกการเข้าสู่ระบบด้วยบัญชีภายนอกแล้ว",
  OAUTH_EMAIL_UNVERIFIED:
    "อีเมลของบัญชีนี้ยังไม่ได้ยืนยันกับผู้ให้บริการ กรุณายืนยันอีเมลก่อน หรือสมัครด้วยอีเมลและรหัสผ่าน",
  OAUTH_STATE_INVALID:
    "ลิงก์เข้าสู่ระบบหมดอายุ กรุณากดปุ่มเข้าสู่ระบบอีกครั้ง",
  OAUTH_NOT_CONFIGURED:
    "การเข้าสู่ระบบด้วยบัญชีนี้ยังไม่เปิดใช้งาน",
  OAUTH_PROFILE_INVALID:
    "ไม่ได้รับอีเมลจากผู้ให้บริการ กรุณาอนุญาตให้เข้าถึงอีเมลแล้วลองใหม่",
}

export function getOAuthErrorMessage(
  code: string | null,
): string | null {
  if (!code) {
    return null
  }

  return (
    OAUTH_ERROR_MESSAGES[code] ??
    "เข้าสู่ระบบด้วยบัญชีภายนอกไม่สำเร็จ กรุณาลองใหม่อีกครั้ง"
  )
}
