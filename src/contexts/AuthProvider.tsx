import {
  useEffect,
  useState,
  type ReactNode,
} from "react"

import {
  getMe,
  login as loginRequest,
} from "../services/auth.service"

import {
  clearAccessToken,
  getAccessToken,
  setAccessToken,
} from "../services/api"

import type {
  LoginInput,
  User,
} from "../types/auth"

import {
  AuthContext,
} from "./AuthContext"

interface AuthProviderProps {
  children: ReactNode
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<User | null>(null)

  const [isLoading, setIsLoading] =
    useState(
      () => getAccessToken() !== null,
    )

  useEffect(() => {
    const token = getAccessToken()

    if (!token) {
      return
    }

    let cancelled = false

    async function restoreSession() {
      try {
        const response =
          await getMe()

        if (!cancelled) {
          setUser(
            response.data.user,
          )
        }
      } catch {
        clearAccessToken()

        if (!cancelled) {
          setUser(null)
        }
      } finally {
        if (!cancelled) {
          setIsLoading(false)
        }
      }
    }

    void restoreSession()

    return () => {
      cancelled = true
    }
  }, [])

  async function login(
    input: LoginInput,
  ): Promise<void> {
    const response =
      await loginRequest(input)

    setAccessToken(
      response.data.token,
    )

    try {
      const meResponse =
        await getMe()

      setUser(
        meResponse.data.user,
      )
    } catch (error) {
      clearAccessToken()
      setUser(null)
      throw error
    }
  }

  function logout(): void {
    clearAccessToken()
    setUser(null)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated:
          user !== null,
        isLoading,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}