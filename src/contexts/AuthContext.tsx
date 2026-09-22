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
  logout: () => void
}

export const AuthContext =
  createContext<AuthContextValue | null>(
    null,
  )