import type { MailMessage } from "./mail.service.js";

const APP_NAME = "AI Resume Analyzer";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function formatThaiDateTime(date: Date): string {
  return new Intl.DateTimeFormat("th-TH", {
    timeZone: "Asia/Bangkok",
    dateStyle: "long",
    timeStyle: "short",
  }).format(date);
}

/*
 * โครง HTML ร่วมของทุกอีเมล
 */
function layout(content: string): string {
  return `
<!doctype html>
<html lang="th">
  <body style="margin:0;padding:24px;background:#f4f6fa;font-family:Arial,sans-serif;color:#1e3156;">
    <table role="presentation" width="100%" style="max-width:520px;margin:0 auto;background:#ffffff;border-radius:12px;padding:32px;">
      <tr>
        <td>
          <p style="margin:0 0 24px;font-size:18px;font-weight:bold;">${APP_NAME}</p>
          ${content}
        </td>
      </tr>
    </table>
  </body>
</html>`;
}

export function passwordResetOtpEmail(input: {
  to: string;
  firstName: string;
  otp: string;
  ttlMinutes: number;
}): MailMessage {
  const name = escapeHtml(input.firstName);

  return {
    to: input.to,
    subject: `รหัส OTP สำหรับรีเซ็ตรหัสผ่าน ${APP_NAME}`,

    text: [
      `สวัสดี ${input.firstName}`,
      "",
      `รหัส OTP สำหรับรีเซ็ตรหัสผ่านของคุณคือ: ${input.otp}`,
      `รหัสนี้จะหมดอายุใน ${input.ttlMinutes} นาที`,
      "",
      "หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ให้เพิกเฉยอีเมลนี้ รหัสผ่านของคุณจะไม่ถูกเปลี่ยน",
    ].join("\n"),

    html: layout(`
      <p style="margin:0 0 12px;">สวัสดี ${name}</p>
      <p style="margin:0 0 20px;">รหัส OTP สำหรับรีเซ็ตรหัสผ่านของคุณคือ</p>
      <p style="margin:0 0 20px;padding:16px;border-radius:8px;background:#fdd6cd;text-align:center;font-size:32px;font-weight:bold;letter-spacing:8px;">${input.otp}</p>
      <p style="margin:0 0 20px;color:#5b6b85;">รหัสนี้จะหมดอายุใน ${input.ttlMinutes} นาที ห้ามบอกรหัสนี้กับผู้อื่น</p>
      <p style="margin:0;color:#5b6b85;font-size:13px;">หากคุณไม่ได้ขอรีเซ็ตรหัสผ่าน ให้เพิกเฉยอีเมลนี้ รหัสผ่านของคุณจะไม่ถูกเปลี่ยน</p>
    `),
  };
}

export function passwordChangedEmail(input: {
  to: string;
  firstName: string;
  changedAt: Date;
}): MailMessage {
  const name = escapeHtml(input.firstName);
  const changedAt = formatThaiDateTime(input.changedAt);

  return {
    to: input.to,
    subject: `รหัสผ่าน ${APP_NAME} ของคุณถูกเปลี่ยนแล้ว`,

    text: [
      `สวัสดี ${input.firstName}`,
      "",
      `รหัสผ่านบัญชีของคุณถูกเปลี่ยนเมื่อ ${changedAt}`,
      "",
      "หากไม่ใช่คุณเป็นผู้เปลี่ยน ให้รีเซ็ตรหัสผ่านทันทีจากหน้า \"ลืมรหัสผ่าน\"",
    ].join("\n"),

    html: layout(`
      <p style="margin:0 0 12px;">สวัสดี ${name}</p>
      <p style="margin:0 0 20px;">รหัสผ่านบัญชีของคุณถูกเปลี่ยนเมื่อ <strong>${changedAt}</strong></p>
      <p style="margin:0;padding:12px 16px;border-radius:8px;background:#fdecea;color:#a84435;">หากไม่ใช่คุณเป็นผู้เปลี่ยน ให้รีเซ็ตรหัสผ่านทันทีจากหน้า "ลืมรหัสผ่าน"</p>
    `),
  };
}
