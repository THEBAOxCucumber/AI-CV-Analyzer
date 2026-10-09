import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  Link,
  useNavigate,
} from "react-router-dom"

import {
  useAuth,
} from "../hooks/useAuth"

import {
  ApiError,
} from "../services/api"

import "../styles/pages/SignInPage.css"

/*
 * กลับมาจาก Google: /auth/callback#code=<login code>
 * - code อยู่หลัง # → ไม่ถูกส่งไป server / ไม่ติด Referer
 * - ลบออกจาก URL ทันที (ไม่ค้างใน history)
 * - code ใช้ได้ครั้งเดียว → กัน StrictMode เรียกซ้ำด้วย ref
 */
export function OAuthCallbackPage() {
  const navigate = useNavigate()

  const {
    loginWithOAuthCode,
  } = useAuth()

  const startedRef = useRef(false)

  const [error, setError] =
    useState("")

  useEffect(() => {
    if (startedRef.current) {
      return
    }

    startedRef.current = true

    const code =
      new URLSearchParams(
        window.location.hash.slice(1),
      ).get("code")

    window.history.replaceState(
      null,
      "",
      window.location.pathname,
    )

    if (!code) {
      navigate(
        "/sign-in?oauthError=OAUTH_STATE_INVALID",
        { replace: true },
      )
      return
    }

    loginWithOAuthCode(code)
      .then((user) => {
        navigate(
          user.needsPassword
            ? "/set-password"
            : "/dashboard",
          { replace: true },
        )
      })
      .catch((caughtError) => {
        setError(
          caughtError instanceof ApiError
            ? caughtError.message
            : "เข้าสู่ระบบไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
        )
      })
  }, [loginWithOAuthCode, navigate])

  if (error) {
    return (
      <main className="auth-loading auth-callback">
        <p className="sign-in__error" role="alert">
          {error}
        </p>

        <Link
          className="sign-in__register-link"
          to="/sign-in"
          replace
        >
          กลับไปหน้าเข้าสู่ระบบ
        </Link>
      </main>
    )
  }

  return (
    <main className="auth-loading" aria-live="polite">
      กำลังเข้าสู่ระบบ...
    </main>
  )
}
