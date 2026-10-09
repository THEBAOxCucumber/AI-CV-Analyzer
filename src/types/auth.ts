export type UserRole =
  | "USER"
  | "ADMIN"

export interface User {
  id: number
  firstName: string
  lastName: string
  email: string
  role: UserRole
  createdAt: string
  lastLoginAt: string | null
  // บัญชีจาก Google ที่ยังไม่ได้ตั้งรหัสผ่าน → ต้องตั้งก่อนใช้งาน
  needsPassword: boolean
}

export type OAuthProvider = "google"

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