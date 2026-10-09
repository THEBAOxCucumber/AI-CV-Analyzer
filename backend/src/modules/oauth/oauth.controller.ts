import type {
  Request,
  Response,
} from "express";

import { env } from "../../config/env.js";
import { AppError } from "../../errors/app-error.js";
import { asyncHandler } from "../../shared/async-handler.js";
import {
  isOAuthProviderId,
  listProviderStatus,
  type OAuthProviderId,
} from "./oauth.providers.js";
import {
  completeAuthorization,
  createAuthorizationUrl,
  exchangeLoginCode,
  OAuthFlowError,
} from "./oauth.service.js";
import type { OAuthExchangeBody } from "./oauth.validation.js";

function requireProvider(req: Request): OAuthProviderId {
  const provider = String(req.params.provider);

  if (!isOAuthProviderId(provider)) {
    throw new AppError("ไม่รู้จักผู้ให้บริการนี้", 404, "OAUTH_PROVIDER_NOT_FOUND");
  }

  return provider;
}

/*
 * ปลายทางคงที่จาก env เท่านั้น (ไม่รับ redirect จาก query → ไม่มี open redirect)
 */
function redirectToSignInWithError(
  res: Response,
  provider: OAuthProviderId,
  error: unknown,
): void {
  const code =
    error instanceof OAuthFlowError
      ? error.code
      : "OAUTH_FAILED";

  console.warn("OAuth login failed:", {
    provider,
    code,
    detail: error instanceof Error ? error.message : String(error),
  });

  res.redirect(
    302,
    `${env.oauth.frontendUrl}/sign-in?oauthError=${encodeURIComponent(code)}`,
  );
}

export const getProvidersController = (
  _req: Request,
  res: Response,
): void => {
  res.json({
    success: true,
    data: { providers: listProviderStatus() },
  });
};

export const startOAuthController = asyncHandler(
  async (req: Request, res: Response) => {
    const provider = requireProvider(req);

    try {
      res.redirect(302, await createAuthorizationUrl(provider));
    } catch (error) {
      redirectToSignInWithError(res, provider, error);
    }
  },
);

export const oauthCallbackController = asyncHandler(
  async (req: Request, res: Response) => {
    const provider = requireProvider(req);

    const pick = (key: string) =>
      typeof req.query[key] === "string" ? (req.query[key] as string) : undefined;

    try {
      const loginCode = await completeAuthorization(provider, {
        code: pick("code"),
        state: pick("state"),
        error: pick("error"),
      });

      // อยู่หลัง # → ไม่ถูกส่งไป server / ไม่ติด Referer
      res.redirect(
        302,
        `${env.oauth.frontendUrl}/auth/callback#code=${encodeURIComponent(loginCode)}`,
      );
    } catch (error) {
      redirectToSignInWithError(res, provider, error);
    }
  },
);

export const exchangeController = asyncHandler(
  async (
    req: Request<object, object, OAuthExchangeBody>,
    res: Response,
  ) => {
    const result = await exchangeLoginCode(req.body.code);

    res.json({
      success: true,
      message: "เข้าสู่ระบบสำเร็จ",
      data: result,
    });
  },
);
