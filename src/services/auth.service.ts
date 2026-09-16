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