import { createHash } from "node:crypto";

import request from "supertest";
import {
  afterAll,
  afterEach,
  beforeAll,
  describe,
  expect,
  it,
  vi,
} from "vitest";

import { app } from "../../src/app.js";
import { database } from "../../src/config/database.js";
import { env } from "../../src/config/env.js";

const createdEmails: string[] = [];
const originalOAuth = structuredClone(env.oauth);

function uniqueEmail(prefix: string): string {
  const email = `${prefix}-${Date.now()}-${Math.random()}@test.local`;
  createdEmails.push(email);
  return email;
}

function uniqueIp(): string {
  const part = () => Math.floor(Math.random() * 250) + 1;
  return `10.${part()}.${part()}.${part()}`;
}

interface FakeProfile {
  sub: string;
  email: string;
  email_verified: boolean | string;
  given_name?: string;
  family_name?: string;
}

/*
 * จำลอง Google: token endpoint + userinfo
 * เก็บ body ที่ส่งไป token endpoint ไว้ตรวจ (PKCE / redirect_uri)
 */
function mockProvider(profile: FakeProfile) {
  const tokenRequests: URLSearchParams[] = [];
  const realFetch = globalThis.fetch;

  const spy = vi.spyOn(globalThis, "fetch").mockImplementation(async (input, init) => {
    const url = String(input);

    if (url.includes("oauth2.googleapis.com/token")) {
      tokenRequests.push(new URLSearchParams(String(init?.body)));
      return new Response(JSON.stringify({ access_token: "fake-access-token" }), { status: 200 });
    }

    if (url.includes("openidconnect.googleapis.com")) {
      return new Response(JSON.stringify(profile), { status: 200 });
    }

    return realFetch(input, init);
  });

  return { spy, tokenRequests };
}

/*
 * start → (ผู้ใช้ยอมรับที่ผู้ให้บริการ) → callback → คืน URL ที่ backend redirect ไป
 */
async function runFlow(provider: "google", ip = uniqueIp()) {
  const start = await request(app)
    .get(`/api/auth/oauth/${provider}/start`)
    .set("X-Forwarded-For", ip);

  expect(start.status).toBe(302);

  const authorizeUrl = new URL(start.headers.location);
  const state = authorizeUrl.searchParams.get("state")!;

  const callback = await request(app)
    .get(`/api/auth/oauth/${provider}/callback`)
    .query({ code: "provider-code", state });

  expect(callback.status).toBe(302);

  return { authorizeUrl, state, location: callback.headers.location as string };
}

function loginCodeFrom(location: string): string {
  const url = new URL(location);
  expect(url.pathname).toBe("/auth/callback");
  return new URLSearchParams(url.hash.slice(1)).get("code")!;
}

beforeAll(() => {
  env.oauth.publicBaseUrl = "http://localhost:5173";
  env.oauth.frontendUrl = "http://localhost:5173";
  env.oauth.google = { clientId: "test-google-id", clientSecret: "test-google-secret" };
});

afterEach(() => {
  vi.restoreAllMocks();
});

afterAll(async () => {
  Object.assign(env.oauth, originalOAuth);

  for (const email of createdEmails) {
    await database.execute("DELETE FROM users WHERE email = ?", [email]);
  }
});

describe("OAuth configuration", () => {
  it("reports whether Google is enabled", async () => {
    const enabled = await request(app).get("/api/auth/oauth/providers");
    expect(enabled.body.data.providers).toEqual({ google: true });

    env.oauth.google = { clientId: "", clientSecret: "" };

    const disabled = await request(app).get("/api/auth/oauth/providers");
    expect(disabled.body.data.providers).toEqual({ google: false });

    const start = await request(app)
      .get("/api/auth/oauth/google/start")
      .set("X-Forwarded-For", uniqueIp());

    expect(start.status).toBe(302);
    expect(start.headers.location).toBe("http://localhost:5173/sign-in?oauthError=OAUTH_NOT_CONFIGURED");

    env.oauth.google = { clientId: "test-google-id", clientSecret: "test-google-secret" };
  });

  it("returns 404 for unsupported providers (LinkedIn was removed)", async () => {
    for (const provider of ["linkedin", "facebook"]) {
      const response = await request(app).get(`/api/auth/oauth/${provider}/start`);
      expect(response.status).toBe(404);
    }
  });

  it("builds the Google authorize URL with state and PKCE", async () => {
    const start = await request(app)
      .get("/api/auth/oauth/google/start")
      .set("X-Forwarded-For", uniqueIp());

    const url = new URL(start.headers.location);

    expect(url.origin + url.pathname).toBe("https://accounts.google.com/o/oauth2/v2/auth");
    expect(url.searchParams.get("client_id")).toBe("test-google-id");
    expect(url.searchParams.get("redirect_uri")).toBe("http://localhost:5173/api/auth/oauth/google/callback");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
    expect(url.searchParams.get("state")).toMatch(/^[\w-]{43}$/);
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
  });
});

describe("OAuth login flow", () => {
  it("creates a new user who must set a password, with single-use codes", async () => {
    const email = uniqueEmail("oauth-new");
    const { tokenRequests } = mockProvider({
      sub: `google-${Date.now()}`,
      email,
      email_verified: true,
      given_name: "Ada",
      family_name: "Lovelace",
    });

    const { authorizeUrl, state, location } = await runFlow("google");

    // PKCE: verifier ที่ส่งตอนแลก token ต้องตรงกับ challenge ตอนเริ่ม
    const verifier = tokenRequests[0].get("code_verifier")!;
    expect(createHash("sha256").update(verifier).digest("base64url")).toBe(
      authorizeUrl.searchParams.get("code_challenge"),
    );
    expect(tokenRequests[0].get("redirect_uri")).toBe("http://localhost:5173/api/auth/oauth/google/callback");

    // state ใช้ซ้ำไม่ได้
    const replay = await request(app)
      .get("/api/auth/oauth/google/callback")
      .query({ code: "provider-code", state });
    expect(replay.headers.location).toContain("oauthError=OAUTH_STATE_INVALID");

    const code = loginCodeFrom(location);

    const exchange = await request(app)
      .post("/api/auth/oauth/exchange")
      .set("X-Forwarded-For", uniqueIp())
      .send({ code });

    expect(exchange.status).toBe(200);
    expect(exchange.body.data.user).toMatchObject({
      email,
      firstName: "Ada",
      lastName: "Lovelace",
      needsPassword: true,
    });

    // login code ใช้ซ้ำไม่ได้
    const again = await request(app)
      .post("/api/auth/oauth/exchange")
      .set("X-Forwarded-For", uniqueIp())
      .send({ code });
    expect(again.status).toBe(400);

    const token = exchange.body.data.token;

    // ยังล็อกอินด้วยรหัสผ่านไม่ได้ (รหัสเป็นค่าสุ่ม)
    const passwordLogin = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", uniqueIp())
      .send({ email, password: "NewPassword123!" });
    expect(passwordLogin.status).toBe(401);

    const setPassword = await request(app)
      .post("/api/auth/set-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "NewPassword123!" });

    expect(setPassword.status).toBe(200);
    expect(setPassword.body.data.user.needsPassword).toBe(false);

    const me = await request(app).get("/api/auth/me").set("Authorization", `Bearer ${token}`);
    expect(me.body.data.user.needsPassword).toBe(false);

    const setAgain = await request(app)
      .post("/api/auth/set-password")
      .set("Authorization", `Bearer ${token}`)
      .send({ newPassword: "OtherPassword123!" });
    expect(setAgain.status).toBe(409);

    const loginNow = await request(app)
      .post("/api/auth/login")
      .set("X-Forwarded-For", uniqueIp())
      .send({ email, password: "NewPassword123!" });
    expect(loginNow.status).toBe(200);
  });

  it("links a verified email to an existing password account", async () => {
    const email = uniqueEmail("oauth-link");

    const register = await request(app)
      .post("/api/auth/register")
      .send({ firstName: "Link", lastName: "Me", email, password: "TestPassword123!" });

    expect(register.status).toBe(201);

    // อีเมลตัวพิมพ์ใหญ่ + email_verified เป็น string ก็ต้องเชื่อมได้
    mockProvider({
      sub: `google-link-${Date.now()}`,
      email: email.toUpperCase(),
      email_verified: "true",
    });

    const { location } = await runFlow("google");

    const exchange = await request(app)
      .post("/api/auth/oauth/exchange")
      .set("X-Forwarded-For", uniqueIp())
      .send({ code: loginCodeFrom(location) });

    expect(exchange.body.data.user).toMatchObject({
      id: register.body.data.user.id,
      needsPassword: false,
    });
  });

  it("logs in the same user by provider id even if the email changed", async () => {
    const sub = `google-stable-${Date.now()}`;
    const firstEmail = uniqueEmail("oauth-stable");

    mockProvider({ sub, email: firstEmail, email_verified: true, given_name: "S", family_name: "T" });
    const first = await runFlow("google");
    const firstUser = await request(app)
      .post("/api/auth/oauth/exchange")
      .set("X-Forwarded-For", uniqueIp())
      .send({ code: loginCodeFrom(first.location) });

    vi.restoreAllMocks();

    mockProvider({ sub, email: uniqueEmail("oauth-stable-new"), email_verified: true });
    const second = await runFlow("google");
    const secondUser = await request(app)
      .post("/api/auth/oauth/exchange")
      .set("X-Forwarded-For", uniqueIp())
      .send({ code: loginCodeFrom(second.location) });

    expect(secondUser.body.data.user.id).toBe(firstUser.body.data.user.id);
  });

  it("rejects unverified emails without creating an account", async () => {
    const email = uniqueEmail("oauth-unverified");

    mockProvider({ sub: `google-unverified-${Date.now()}`, email, email_verified: false });

    const { location } = await runFlow("google");

    expect(location).toBe("http://localhost:5173/sign-in?oauthError=OAUTH_EMAIL_UNVERIFIED");

    const [rows] = await database.execute<import("mysql2").RowDataPacket[]>(
      "SELECT id FROM users WHERE email = ?",
      [email],
    );
    expect(rows).toHaveLength(0);
  });

  it("handles a user cancelling at the provider", async () => {
    const start = await request(app)
      .get("/api/auth/oauth/google/start")
      .set("X-Forwarded-For", uniqueIp());
    const state = new URL(start.headers.location).searchParams.get("state");

    const callback = await request(app)
      .get("/api/auth/oauth/google/callback")
      .query({ error: "access_denied", state });

    expect(callback.headers.location).toBe("http://localhost:5173/sign-in?oauthError=OAUTH_CANCELLED");
  });

  it("rejects an unknown state", async () => {
    const callback = await request(app)
      .get("/api/auth/oauth/google/callback")
      .query({ code: "x", state: "forged-state-value" });

    expect(callback.headers.location).toContain("oauthError=OAUTH_STATE_INVALID");
  });

  it("validates the exchange code format", async () => {
    const response = await request(app)
      .post("/api/auth/oauth/exchange")
      .set("X-Forwarded-For", uniqueIp())
      .send({ code: "../../etc" });

    expect(response.status).toBe(400);
  });
});
