import { Router } from "express";

import { authIpRateLimit } from "../../middleware/rate-limit.middleware.js";
import { validate } from "../../middleware/validate.middleware.js";
import {
  exchangeController,
  getProvidersController,
  oauthCallbackController,
  startOAuthController,
} from "./oauth.controller.js";
import { oauthExchangeSchema } from "./oauth.validation.js";

/*
 * /api/auth/oauth/*
 *   GET  /providers             — provider ไหนเปิดใช้ (ปุ่มหน้า Sign In)
 *   GET  /:provider/start       — ไปหน้าล็อกอินของ Google
 *   GET  /:provider/callback    — ผู้ให้บริการส่งกลับมา → redirect ไปหน้าเว็บพร้อม login code
 *   POST /exchange              — แลก login code เป็น JWT
 */
export const oauthRouter = Router();

oauthRouter.get("/providers", getProvidersController);

oauthRouter.get(
  "/:provider/start",
  authIpRateLimit,
  startOAuthController,
);

oauthRouter.get(
  "/:provider/callback",
  oauthCallbackController,
);

oauthRouter.post(
  "/exchange",
  authIpRateLimit,
  validate({ body: oauthExchangeSchema }),
  exchangeController,
);
