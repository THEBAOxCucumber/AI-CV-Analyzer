import {
  useState,
  type SubmitEvent,
} from "react"

import {
  Link,
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom"

import {
  CheckCircle2,
  LockKeyhole,
} from "lucide-react"

import {
  AuthShowcase,
} from "../components/auth/AuthShowcase"

import {
  Button,
} from "../components/ui/Button"

import {
  Input,
} from "../components/ui/Input"

import {
  ApiError,
} from "../services/api"

import {
  useAuth,
} from "../hooks/useAuth"

import {
  OAuthButtons,
} from "../components/auth/OAuthButtons"

import {
  getOAuthErrorMessage,
} from "../utils/oauth-errors"

import "../styles/pages/SignInPage.css"

interface LocationState {
  from?: string
  registrationSuccess?: boolean
}

export function SignInPage() {
  const navigate = useNavigate()
  const location = useLocation()

  const {
    login,
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth()

  const [email, setEmail] =
    useState("")

  const [password, setPassword] =
    useState("")

  const [error, setError] =
    useState("")

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  // กลับมาจาก Google ไม่สำเร็จ (?oauthError=…)
  const oauthError =
    getOAuthErrorMessage(
      new URLSearchParams(location.search)
        .get("oauthError"),
    )

  // มาจากหน้าสมัครสมาชิกสำเร็จ
  const registrationSuccess =
    (location.state as LocationState | null)
      ?.registrationSuccess === true

  if (isAuthLoading) {
    return (
      <main className="auth-loading">
        กำลังตรวจสอบการเข้าสู่ระบบ...
      </main>
    )
  }

  if (isAuthenticated) {
    return (
      <Navigate
        to="/dashboard"
        replace
      />
    )
  }

  async function handleSubmit(
    event: SubmitEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError("")

    const normalizedEmail =
      email.trim().toLowerCase()

    if (!normalizedEmail) {
      setError("กรุณากรอกอีเมล")
      return
    }

    if (!password) {
      setError("กรุณากรอกรหัสผ่าน")
      return
    }

    setIsSubmitting(true)

    try {
      await login({
        email: normalizedEmail,
        password,
      })

      const state =
        location.state as
        | LocationState
        | null

      navigate(
        state?.from ??
        "/dashboard",
        {
          replace: true,
        },
      )
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError
      ) {
        if (
          caughtError.code ===
          "INVALID_CREDENTIALS"
        ) {
          setError(
            "อีเมลหรือรหัสผ่านไม่ถูกต้อง",
          )
        } else {
          setError(
            caughtError.message,
          )
        }
      } else {
        setError(
          "ไม่สามารถเข้าสู่ระบบได้ กรุณาลองใหม่อีกครั้ง",
        )
      }
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="sign-in">
      <AuthShowcase
        title={
          <>
            พัฒนา Resume
            <br />
            ให้พร้อมสำหรับงาน
            <br />
            ที่คุณต้องการ
          </>
        }
        description="วิเคราะห์ Resume ด้วย AI เพื่อค้นหาจุดแข็ง จุดที่ควรปรับปรุง และความเหมาะสมกับตำแหน่งงาน"
      />

      <section className="sign-in__form-side">
        <div className="sign-in__card">
          <div className="sign-in__icon">
            <LockKeyhole
              size={28}
            />
          </div>

          <div className="sign-in__heading">
            <h2>
              เข้าสู่ระบบ
            </h2>

            <p>
              ยินดีต้อนรับกลับ
              เข้าสู่บัญชีของคุณเพื่อดำเนินการต่อ
            </p>
          </div>

          {registrationSuccess && !error && (
            <div
              className="sign-in__notice"
              role="status"
            >
              <CheckCircle2
                size={18}
                aria-hidden="true"
              />
              สมัครสมาชิกสำเร็จ เข้าสู่ระบบด้วยอีเมลที่สมัครไว้ได้เลย
            </div>
          )}

          <form
            className="sign-in__form"
            onSubmit={handleSubmit}
          >
            <Input
              id="email"
              type="email"
              label="อีเมล"
              placeholder="name@example.com"
              autoComplete="email"
              value={email}
              onChange={(event) => {
                setEmail(
                  event.target.value,
                )
              }}
            />

            <Input
              id="password"
              type="password"
              label="รหัสผ่าน"
              placeholder="กรอกรหัสผ่าน"
              autoComplete="current-password"
              value={password}
              onChange={(event) => {
                setPassword(
                  event.target.value,
                )
              }}
            />

            <Link
              className="sign-in__forgot"
              to="/forgot-password"
            >
              ลืมรหัสผ่าน?
            </Link>

            {(error || oauthError) && (
              <div
                className="sign-in__error"
                role="alert"
              >
                {error || oauthError}
              </div>
            )}

            <Button
              type="submit"
              fullWidth
              loading={isSubmitting}
            >
              เข้าสู่ระบบ
            </Button>
          </form>

          <OAuthButtons />

          <p className="sign-in__register">
            ยังไม่มีบัญชี?{" "}
            <Link
              className="sign-in__register-link"
              to="/register"
            >
              สมัครสมาชิก
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}