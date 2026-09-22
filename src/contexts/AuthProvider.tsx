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

interface JwtPayload {
  exp?: number
}

function getTokenExpirationMs(
  token: string,
): number | null {
  try {
    const payloadPart =
      token.split(".")[1]

    if (!payloadPart) {
      return null
    }

    const normalized =
      payloadPart
        .replace(/-/g, "+")
        .replace(/_/g, "/")

    const payload =
      JSON.parse(
        atob(normalized),
      ) as JwtPayload

    if (
      typeof payload.exp !== "number"
    ) {
      return null
    }

    return payload.exp * 1000
  } catch {
    return null
  }
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<User | null>(null)

  const [
    sessionRemainingSeconds,
    setSessionRemainingSeconds,
  ] = useState(0)

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

  /*
   * นับถอยหลังตาม exp ใน JWT จริง
   */
  useEffect(() => {
    if (!user) {
      setSessionRemainingSeconds(0)
      return
    }

    const token = getAccessToken()

    if (!token) {
      logout()
      return
    }

    const expirationMs =
  getTokenExpirationMs(token)

if (expirationMs === null) {
  logout()
  return
}

const expiresAt: number =
  expirationMs

    function updateCountdown() {
      const remaining =
        Math.max(
          0,
          Math.ceil(
            (expiresAt - Date.now()) /
              1000,
          ),
        )

      setSessionRemainingSeconds(
        remaining,
      )

      if (remaining <= 0) {
        logout()
      }
    }

    updateCountdown()

    const intervalId =
      window.setInterval(
        updateCountdown,
        1000,
      )

    return () => {
      window.clearInterval(
        intervalId,
      )
    }
  }, [user])

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
    setSessionRemainingSeconds(0)
  }

  return (
    <AuthContext.Provider
      value={{
        user,
        isAuthenticated:
          user !== null,
        isLoading,
        sessionRemainingSeconds,
        login,
        logout,
      }}
    >
      {children}
    </AuthContext.Provider>
  )
}