import {
  createContext,
} from "react"

import type {
  LoginInput,
  User,
} from "../types/auth"

export interface AuthContextValue {
  user: User | null
  isAuthenticated: boolean
  isLoading: boolean
  sessionRemainingSeconds: number
  login: (
    input: LoginInput,
  ) => Promise<void>
  // หลังกลับจาก Google — คืนผู้ใช้เพื่อเลือกหน้าถัดไป
  loginWithOAuthCode: (
    code: string,
  ) => Promise<User>
  // อัปเดตข้อมูลผู้ใช้ในหน่วยความจำ (เช่น หลังตั้งรหัสผ่าน)
  updateUser: (
    user: User,
  ) => void
  logout: () => void
}

export const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  )