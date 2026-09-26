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

function getRemainingSeconds(
  token: string,
): number {
  const expirationMs =
    getTokenExpirationMs(token)

  if (expirationMs === null) {
    return 0
  }

  return Math.max(
    0,
    Math.ceil(
      (expirationMs - Date.now()) /
        1000,
    ),
  )
}

export function AuthProvider({
  children,
}: AuthProviderProps) {
  const [user, setUser] =
    useState<User | null>(null)

  const [
    sessionRemainingSeconds,
    setSessionRemainingSeconds,
  ] = useState(() => {
    const token = getAccessToken()

    return token
      ? getRemainingSeconds(token)
      : 0
  })

  const [isLoading, setIsLoading] =
    useState(
      () => getAccessToken() !== null,
    )

  /*
   * Restore session หลัง refresh
   */
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
          setSessionRemainingSeconds(0)
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
      return
    }

    const token = getAccessToken()

    if (!token) {
      return
    }

    const expirationMs =
      getTokenExpirationMs(token)

    if (expirationMs === null) {
      return
    }

    const intervalId =
      window.setInterval(() => {
        const remaining =
          Math.max(
            0,
            Math.ceil(
              (
                expirationMs -
                Date.now()
              ) / 1000,
            ),
          )

        setSessionRemainingSeconds(
          remaining,
        )

        if (remaining <= 0) {
          clearAccessToken()
          setUser(null)

          window.clearInterval(
            intervalId,
          )
        }
      }, 1000)

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

    const token =
      response.data.token

    setAccessToken(token)

    try {
      const meResponse =
        await getMe()

      setSessionRemainingSeconds(
        getRemainingSeconds(token),
      )

      setUser(
        meResponse.data.user,
      )
    } catch (error) {
      clearAccessToken()
      setSessionRemainingSeconds(0)
      setUser(null)

      throw error
    }
  }

  function logout(): void {
    clearAccessToken()
    setSessionRemainingSeconds(0)
    setUser(null)
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