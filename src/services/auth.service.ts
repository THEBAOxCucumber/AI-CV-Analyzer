import {
  apiRequest,
} from "./api"

import type {
  ApiResponse,
  AuthData,
  LoginInput,
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