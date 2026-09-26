import nodemailer, {
  type Transporter,
} from "nodemailer";

import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";

export interface MailMessage {
  to: string;
  subject: string;
  text: string;
  html: string;
}

let transporter: Transporter | null = null;

export function isMailConfigured(): boolean {
  return Boolean(
    env.mail.user &&
    env.mail.password,
  );
}

function getTransporter(): Transporter {
  transporter ??=
    nodemailer.createTransport({
      host: env.mail.host,
      port: env.mail.port,

      /*
       * 465 = TLS ตั้งแต่ต้น
       * 587 = STARTTLS
       */
      secure: env.mail.port === 465,

      auth: {
        user: env.mail.user,
        pass: env.mail.password,
      },

      /*
       * กัน request ค้างถ้า SMTP ช้า
       */
      connectionTimeout: 10_000,
      greetingTimeout: 10_000,
      socketTimeout: 15_000,
    });

  return transporter;
}

export async function sendMail(
  message: MailMessage,
): Promise<void> {
  if (!isMailConfigured()) {
    throw new AppError(
      "ระบบอีเมลยังไม่ได้ตั้งค่า กรุณาติดต่อผู้ดูแลระบบ",
      503,
      "EMAIL_NOT_CONFIGURED",
    );
  }

  try {
    await getTransporter().sendMail({
      from: env.mail.from,
      ...message,
    });
  } catch (error) {
    /*
     * log ดิบไว้ฝั่ง server เท่านั้น
     */
    console.error(
      "Send mail failed:",
      {
        to: message.to,
        subject: message.subject,
        error:
          error instanceof Error
            ? error.message
            : String(error),
      },
    );

    throw new AppError(
      "ไม่สามารถส่งอีเมลได้ กรุณาลองใหม่อีกครั้ง",
      503,
      "EMAIL_SEND_FAILED",
    );
  }
}
