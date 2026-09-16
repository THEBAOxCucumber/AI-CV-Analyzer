export type UserRole =
  | "USER"
  | "ADMIN"

export interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  role: UserRole
}

export interface LoginInput {
  email: string
  password: string
}

export interface RegisterInput {
  firstName: string
  lastName: string
  email: string
  password: string
}

export interface AuthData {
  user: User
  token: string
}

export interface ApiResponse<T> {
  success: boolean
  message: string
  data: T
}