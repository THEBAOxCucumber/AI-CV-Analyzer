import { env } from "../../config/env.js";

/*
 * ล็อกอินด้วย Google (OpenID Connect)
 * โครงสร้างรองรับหลาย provider — เพิ่มเจ้าอื่นได้ที่ getProviders()
 */
export type OAuthProviderId = "google";

export interface OAuthProviderConfig {
  id: OAuthProviderId;
  dbName: "GOOGLE";
  label: string;
  authorizeUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  scope: string;
  usePkce: boolean;
  extraAuthorizeParams: Record<string, string>;
  clientId: string;
  clientSecret: string;
}

export interface OAuthProfile {
  providerUserId: string;
  email: string;
  emailVerified: boolean;
  firstName: string;
  lastName: string;
}

function getProviders(): Record<OAuthProviderId, OAuthProviderConfig> {
  return {
    google: {
      id: "google",
      dbName: "GOOGLE",
      label: "Google",
      authorizeUrl: "https://accounts.google.com/o/oauth2/v2/auth",
      tokenUrl: "https://oauth2.googleapis.com/token",
      userInfoUrl: "https://openidconnect.googleapis.com/v1/userinfo",
      scope: "openid email profile",
      usePkce: true,
      extraAuthorizeParams: {
        prompt: "select_account",
      },
      clientId: env.oauth.google.clientId,
      clientSecret: env.oauth.google.clientSecret,
    },
  };
}

export function isOAuthProviderId(
  value: string,
): value is OAuthProviderId {
  return value === "google";
}

export function getProvider(
  id: OAuthProviderId,
): OAuthProviderConfig {
  return getProviders()[id];
}

export function isProviderEnabled(
  provider: OAuthProviderConfig,
): boolean {
  return Boolean(provider.clientId && provider.clientSecret);
}

export function listProviderStatus(): Record<OAuthProviderId, boolean> {
  return {
    google: isProviderEnabled(getProviders().google),
  };
}

export function getRedirectUri(
  provider: OAuthProviderConfig,
): string {
  return `${env.oauth.publicBaseUrl}/api/auth/oauth/${provider.id}/callback`;
}

/*
 * userinfo (OIDC) → profile ที่ระบบใช้
 */
export function toOAuthProfile(
  raw: Record<string, unknown>,
): OAuthProfile | null {
  const sub = typeof raw.sub === "string" ? raw.sub : null;
  const email = typeof raw.email === "string" ? raw.email.trim().toLowerCase() : null;

  if (!sub || !email) {
    return null;
  }

  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const [nameFirst = "", ...nameRest] = name.split(/\s+/);

  const firstName =
    (typeof raw.given_name === "string" && raw.given_name.trim()) ||
    nameFirst ||
    email.split("@")[0];

  const lastName =
    (typeof raw.family_name === "string" && raw.family_name.trim()) ||
    nameRest.join(" ") ||
    "-";

  return {
    providerUserId: sub,
    email,
    emailVerified: raw.email_verified === true || raw.email_verified === "true",
    firstName: firstName.slice(0, 100),
    lastName: lastName.slice(0, 100),
  };
}
