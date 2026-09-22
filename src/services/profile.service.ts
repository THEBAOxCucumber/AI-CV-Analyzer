import {
  apiRequest,
} from "./api"

import type {
  ApiResponse,
} from "../types/auth"

import type {
  UpdateProfileInput,
  UserProfile,
} from "../types/profile"

export function getProfile(): Promise<
  ApiResponse<{
    profile: UserProfile
  }>
> {
  return apiRequest<
    ApiResponse<{
      profile: UserProfile
    }>
  >("/profile")
}

export function updateProfile(
  input: UpdateProfileInput,
): Promise<
  ApiResponse<{
    profile: UserProfile
  }>
> {
  return apiRequest<
    ApiResponse<{
      profile: UserProfile
    }>
  >(
    "/profile",
    {
      method: "PUT",
      body: JSON.stringify(input),
    },
  )
}