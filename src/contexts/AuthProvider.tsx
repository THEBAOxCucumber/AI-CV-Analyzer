import {
  useCallback,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react"

import {
  exchangeOAuthCode,
  getMe,
  login as loginRequest,
  refreshSession,
} from "../services/auth.service"

import {
  ApiError,
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
        .replaceAll("-", "+")
        .replaceAll("_", "/")

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
}: Readonly<AuthProviderProps>) {
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

  /*
   * useCallback/useMemo: value คงที่ระหว่าง render
   * consumer ไม่ re-render ถ้าข้อมูลไม่เปลี่ยน (S6481)
   */
  /*
   * เก็บ token แล้วโหลดผู้ใช้ — ใช้ทั้งรหัสผ่านและ Google
   */
  const startSession = useCallback(async (
    token: string,
  ): Promise<User> => {
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

      return meResponse.data.user
    } catch (error) {
      clearAccessToken()
      setSessionRemainingSeconds(0)
      setUser(null)

      throw error
    }
  }, [])

  const login = useCallback(async (
    input: LoginInput,
  ): Promise<void> => {
    const response =
      await loginRequest(input)

    await startSession(response.data.token)
  }, [startSession])

  const loginWithOAuthCode = useCallback(async (
    code: string,
  ): Promise<User> => {
    const response =
      await exchangeOAuthCode(code)

    return startSession(response.data.token)
  }, [startSession])

  const updateUser = useCallback((
    nextUser: User,
  ): void => {
    setUser(nextUser)
  }, [])

  const logout = useCallback((): void => {
    clearAccessToken()
    setSessionRemainingSeconds(0)
    setUser(null)
  }, [])

  /*
   * ต่ออายุเซสชัน: token ใหม่ → setUser ทำให้ตัวนับถอยหลังเริ่มใหม่ตาม exp ใหม่
   * 401 (token หมดอายุไปแล้ว) → ออกจากระบบ, error อื่นส่งต่อให้ผู้เรียก
   */
  const extendSession = useCallback(async (): Promise<void> => {
    try {
      const response =
        await refreshSession()

      setAccessToken(response.data.token)

      setSessionRemainingSeconds(
        getRemainingSeconds(response.data.token),
      )

      setUser(response.data.user)
    } catch (error) {
      if (
        error instanceof ApiError &&
        error.status === 401
      ) {
        logout()
      }

      throw error
    }
  }, [logout])

  const value = useMemo(
    () => ({
      user,
      isAuthenticated:
        user !== null,
      isLoading,
      sessionRemainingSeconds,
      login,
      loginWithOAuthCode,
      updateUser,
      logout,
      extendSession,
    }),
    [
      user,
      isLoading,
      sessionRemainingSeconds,
      login,
      loginWithOAuthCode,
      updateUser,
      logout,
      extendSession,
    ],
  )

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  )
}