import {
  apiRequest,
} from "./api"

import type {
  ApiResponse,
  AuthData,
  LoginInput,
  OAuthProvider,
  RegisterInput,
  User,
} from "../types/auth"

export function login(
  input: LoginInput,
): Promise<ApiResponse<AuthData>> {
  return apiRequest<ApiResponse<AuthData>>(
    "/auth/login",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}

export function register(
  input: RegisterInput,
): Promise<ApiResponse<AuthData>> {
  return apiRequest<ApiResponse<AuthData>>(
    "/auth/register",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}

export function changePassword(input: {
  currentPassword: string
  newPassword: string
}): Promise<ApiResponse<unknown>> {
  return apiRequest<ApiResponse<unknown>>(
    "/auth/change-password",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}

export function forgotPassword(
  email: string,
): Promise<ApiResponse<unknown>> {
  return apiRequest<ApiResponse<unknown>>(
    "/auth/forgot-password",
    {
      method: "POST",
      body: JSON.stringify({ email }),
    },
  )
}

export function resetPassword(input: {
  email: string
  otp: string
  newPassword: string
}): Promise<ApiResponse<unknown>> {
  return apiRequest<ApiResponse<unknown>>(
    "/auth/reset-password",
    {
      method: "POST",
      body: JSON.stringify(input),
    },
  )
}

export function getOAuthProviders(): Promise<
  ApiResponse<{
    providers: Record<OAuthProvider, boolean>
  }>
> {
  return apiRequest<
    ApiResponse<{
      providers: Record<OAuthProvider, boolean>
    }>
  >("/auth/oauth/providers")
}

/*
 * แลก login code (ใช้ครั้งเดียว) จาก Google เป็น token
 */
export function exchangeOAuthCode(
  code: string,
): Promise<ApiResponse<AuthData>> {
  return apiRequest<ApiResponse<AuthData>>(
    "/auth/oauth/exchange",
    {
      method: "POST",
      body: JSON.stringify({ code }),
    },
  )
}

/*
 * ตั้งรหัสผ่านครั้งแรก (บัญชีจาก Google)
 */
export function setInitialPassword(
  newPassword: string,
): Promise<
  ApiResponse<{
    user: User
  }>
> {
  return apiRequest<
    ApiResponse<{
      user: User
    }>
  >("/auth/set-password", {
    method: "POST",
    body: JSON.stringify({ newPassword }),
  })
}

export function getMe(): Promise<
  ApiResponse<{
    user: User
  }>
> {
  return apiRequest<
    ApiResponse<{
      user: User
    }>
  >("/auth/me")
}