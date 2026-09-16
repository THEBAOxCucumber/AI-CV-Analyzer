import {
  useState,
  type FormEvent,
} from "react"

import {
  Navigate,
  useLocation,
  useNavigate,
} from "react-router-dom"

import {
  FileText,
  LockKeyhole,
} from "lucide-react"

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

import "./SignInPage.css"

interface LocationState {
  from?: string
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
    event: FormEvent<HTMLFormElement>,
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
      <section className="sign-in__brand">
        <div className="sign-in__brand-content">
          <div className="sign-in__logo">
            <FileText
              size={34}
              strokeWidth={2}
            />

            <span>
              AI Resume
            </span>
          </div>

          <h1>
            พัฒนา Resume
            <br />
            ให้พร้อมสำหรับงาน
            <br />
            ที่คุณต้องการ
          </h1>

          <p>
            วิเคราะห์ Resume ด้วย AI
            เพื่อค้นหาจุดแข็ง
            จุดที่ควรปรับปรุง
            และความเหมาะสมกับตำแหน่งงาน
          </p>
        </div>
      </section>

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

            {error && (
              <div
                className="sign-in__error"
                role="alert"
              >
                {error}
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

          <p className="sign-in__register">
            ยังไม่มีบัญชี?{" "}
            <span>
              สมัครสมาชิก
            </span>
          </p>

          <p className="sign-in__oauth-note">
            Google และ LinkedIn
            จะเปิดใช้งานเมื่อ backend
            รองรับ OAuth
          </p>
        </div>
      </section>
    </main>
  )
}