import {
  createHash,
  randomBytes,
} from "node:crypto";

import bcrypt from "bcrypt";

import { redisConnection } from "../../config/redis.js";
import { AppError } from "../../errors/app-error.js";
import { issueAuthResultForUser } from "../auth/auth.service.js";
import type { PublicUser } from "../auth/auth.types.js";
import {
  createUserWithOAuthAccount,
  findUserIdByEmail,
  findUserIdByOAuthAccount,
  linkOAuthAccount,
  touchOAuthAccount,
} from "./oauth.repository.js";
import {
  getProvider,
  getRedirectUri,
  isProviderEnabled,
  toOAuthProfile,
  type OAuthProviderConfig,
  type OAuthProviderId,
} from "./oauth.providers.js";

const STATE_TTL_SECONDS = 10 * 60;
const LOGIN_CODE_TTL_SECONDS = 60;
const PROVIDER_TIMEOUT_MS = 10_000;

const stateKey = (state: string) => `oauth:state:${state}`;
const loginCodeKey = (code: string) => `oauth:login:${code}`;

function randomToken(): string {
  return randomBytes(32).toString("base64url");
}

/*
 * ข้อผิดพลาดระหว่าง flow — controller แปลงเป็น redirect ไปหน้า sign-in?oauthError=<code>
 * (ไม่ส่งข้อความจากผู้ให้บริการไปหน้าเว็บ)
 */
export class OAuthFlowError extends Error {
  constructor(
    public readonly code:
      | "OAUTH_NOT_CONFIGURED"
      | "OAUTH_CANCELLED"
      | "OAUTH_STATE_INVALID"
      | "OAUTH_EMAIL_UNVERIFIED"
      | "OAUTH_PROFILE_INVALID"
      | "OAUTH_FAILED",
    detail?: string,
  ) {
    super(detail ?? code);
    this.name = "OAuthFlowError";
  }
}

interface StoredState {
  provider: OAuthProviderId;
  codeVerifier: string | null;
}

function requireEnabled(
  providerId: OAuthProviderId,
): OAuthProviderConfig {
  const provider = getProvider(providerId);

  if (!isProviderEnabled(provider)) {
    throw new OAuthFlowError("OAUTH_NOT_CONFIGURED");
  }

  return provider;
}

/*
 * 1) สร้าง URL ไปหน้าล็อกอินของผู้ให้บริการ
 *    state: ใช้ครั้งเดียว ผูกกับ provider (กัน CSRF / login CSRF)
 *    PKCE (Google): กัน code ถูกดักไปแลก
 */
export async function createAuthorizationUrl(
  providerId: OAuthProviderId,
): Promise<string> {
  const provider = requireEnabled(providerId);

  const state = randomToken();
  const codeVerifier = provider.usePkce ? randomToken() : null;

  const stored: StoredState = {
    provider: provider.id,
    codeVerifier,
  };

  await redisConnection.set(
    stateKey(state),
    JSON.stringify(stored),
    "EX",
    STATE_TTL_SECONDS,
  );

  const params = new URLSearchParams({
    response_type: "code",
    client_id: provider.clientId,
    redirect_uri: getRedirectUri(provider),
    scope: provider.scope,
    state,
    ...provider.extraAuthorizeParams,
  });

  if (codeVerifier) {
    params.set(
      "code_challenge",
      createHash("sha256").update(codeVerifier).digest("base64url"),
    );
    params.set("code_challenge_method", "S256");
  }

  return `${provider.authorizeUrl}?${params.toString()}`;
}

async function exchangeCodeForAccessToken(
  provider: OAuthProviderConfig,
  code: string,
  codeVerifier: string | null,
): Promise<string> {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: getRedirectUri(provider),
    client_id: provider.clientId,
    client_secret: provider.clientSecret,
  });

  if (codeVerifier) {
    body.set("code_verifier", codeVerifier);
  }

  const response = await fetch(provider.tokenUrl, {
    method: "POST",
    headers: {
      "Content-Type": "application/x-www-form-urlencoded",
      Accept: "application/json",
    },
    body,
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  const data = (await response.json().catch(() => ({}))) as {
    access_token?: string;
    error?: string;
  };

  if (!response.ok || !data.access_token) {
    throw new OAuthFlowError(
      "OAUTH_FAILED",
      `token exchange failed: HTTP ${response.status} ${data.error ?? ""}`,
    );
  }

  return data.access_token;
}

async function fetchUserInfo(
  provider: OAuthProviderConfig,
  accessToken: string,
): Promise<Record<string, unknown>> {
  const response = await fetch(provider.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    signal: AbortSignal.timeout(PROVIDER_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new OAuthFlowError(
      "OAUTH_FAILED",
      `userinfo failed: HTTP ${response.status}`,
    );
  }

  return (await response.json()) as Record<string, unknown>;
}

function isDuplicateEntry(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    (error as { code?: string }).code === "ER_DUP_ENTRY"
  );
}

/*
 * หา/เชื่อม/สร้างบัญชี
 * 1. เคยล็อกอินด้วยบัญชีนี้ → ใช้ผู้ใช้เดิม
 * 2. อีเมลตรงกับผู้ใช้เดิม → เชื่อม (ผ่านการตรวจ email_verified แล้ว)
 * 3. ไม่มี → สร้างผู้ใช้ใหม่ (ต้องตั้งรหัสผ่านก่อนใช้งาน)
 */
async function resolveUserId(
  provider: OAuthProviderConfig,
  profile: NonNullable<ReturnType<typeof toOAuthProfile>>,
): Promise<number> {
  const linkedUserId = await findUserIdByOAuthAccount(
    provider.dbName,
    profile.providerUserId,
  );

  if (linkedUserId) {
    await touchOAuthAccount(provider.dbName, profile.providerUserId, profile.email);
    return linkedUserId;
  }

  const existingUserId = await findUserIdByEmail(profile.email);

  if (existingUserId) {
    await linkOAuthAccount(existingUserId, provider.dbName, profile);
    return existingUserId;
  }

  const unusablePasswordHash = await bcrypt.hash(randomToken(), 12);

  try {
    return await createUserWithOAuthAccount(
      provider.dbName,
      profile,
      unusablePasswordHash,
    );
  } catch (error) {
    // สมัครพร้อมกันอีกแท็บ → อีเมลถูกสร้างไปแล้ว ให้เชื่อมแทน
    if (!isDuplicateEntry(error)) throw error;

    const raceUserId = await findUserIdByEmail(profile.email);

    if (!raceUserId) throw error;

    await linkOAuthAccount(raceUserId, provider.dbName, profile);
    return raceUserId;
  }
}

/*
 * 2) ผู้ให้บริการส่งกลับมาที่ callback
 * คืน login code (ใช้ครั้งเดียว 60 วินาที) ให้หน้าเว็บนำไปแลก JWT
 * → JWT ไม่ไปอยู่ใน URL / history / log
 */
export async function completeAuthorization(
  providerId: OAuthProviderId,
  query: {
    code?: string;
    state?: string;
    error?: string;
  },
): Promise<string> {
  const provider = requireEnabled(providerId);

  if (query.error) {
    throw new OAuthFlowError(
      query.error === "access_denied"
        ? "OAUTH_CANCELLED"
        : "OAUTH_FAILED",
      `provider error: ${query.error}`,
    );
  }

  if (!query.state || !query.code) {
    throw new OAuthFlowError("OAUTH_STATE_INVALID", "missing code/state");
  }

  // GETDEL: state ใช้ได้ครั้งเดียว
  const rawState = await redisConnection.getdel(stateKey(query.state));
  const stored = rawState ? (JSON.parse(rawState) as StoredState) : null;

  if (!stored || stored.provider !== provider.id) {
    throw new OAuthFlowError("OAUTH_STATE_INVALID", "unknown or expired state");
  }

  const accessToken = await exchangeCodeForAccessToken(
    provider,
    query.code,
    stored.codeVerifier,
  );

  const profile = toOAuthProfile(await fetchUserInfo(provider, accessToken));

  if (!profile) {
    throw new OAuthFlowError("OAUTH_PROFILE_INVALID", "userinfo missing sub/email");
  }

  // อีเมลที่ยังไม่ยืนยัน → อาจไม่ใช่เจ้าของอีเมลจริง ห้ามใช้เชื่อม/สร้างบัญชี
  if (!profile.emailVerified) {
    throw new OAuthFlowError("OAUTH_EMAIL_UNVERIFIED");
  }

  const userId = await resolveUserId(provider, profile);
  const loginCode = randomToken();

  await redisConnection.set(
    loginCodeKey(loginCode),
    String(userId),
    "EX",
    LOGIN_CODE_TTL_SECONDS,
  );

  return loginCode;
}

/*
 * 3) หน้าเว็บนำ login code มาแลก JWT (ใช้ได้ครั้งเดียว)
 */
export async function exchangeLoginCode(
  code: string,
): Promise<{ user: PublicUser; token: string }> {
  const userId = await redisConnection.getdel(loginCodeKey(code));

  if (!userId) {
    throw new AppError(
      "ลิงก์เข้าสู่ระบบหมดอายุหรือถูกใช้ไปแล้ว กรุณาลองใหม่",
      400,
      "OAUTH_CODE_INVALID",
    );
  }

  return issueAuthResultForUser(Number(userId));
}
