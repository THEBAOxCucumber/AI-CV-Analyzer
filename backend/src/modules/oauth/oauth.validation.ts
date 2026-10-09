import { z } from "zod";

export const oauthExchangeSchema = z.object({
  // base64url 32 bytes = 43 ตัวอักษร
  code: z
    .string()
    .trim()
    .regex(/^[\w-]{20,100}$/, "รหัสเข้าสู่ระบบไม่ถูกต้อง"),
});

export type OAuthExchangeBody = z.infer<typeof oauthExchangeSchema>;
