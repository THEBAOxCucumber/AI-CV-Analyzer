import {
  useState,
  type SubmitEvent,
} from "react"

import {
  Navigate,
  useNavigate,
} from "react-router-dom"

import {
  KeyRound,
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
  PasswordRequirements,
} from "../components/auth/PasswordRequirements"

import {
  ApiError,
} from "../services/api"

import {
  setInitialPassword,
} from "../services/auth.service"

import {
  useAuth,
} from "../hooks/useAuth"

import {
  validateNewPassword,
} from "../utils/password"

import "../styles/pages/SignInPage.css"

/*
 * บัญชีที่สมัครผ่าน Google ต้องตั้งรหัสผ่านก่อนใช้งาน
 * (ProtectedRoute พามาที่นี่จนกว่าจะตั้งเสร็จ)
 */
export function SetPasswordPage() {
  const navigate = useNavigate()

  const {
    user,
    updateUser,
    logout,
  } = useAuth()

  const [password, setPassword] =
    useState("")

  const [confirmPassword, setConfirmPassword] =
    useState("")

  const [error, setError] =
    useState("")

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  if (user && !user.needsPassword) {
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

    const validationError =
      validateNewPassword(
        password,
        confirmPassword,
      )

    if (validationError) {
      setError(validationError)
      return
    }

    setError("")
    setIsSubmitting(true)

    try {
      const response =
        await setInitialPassword(password)

      updateUser(response.data.user)

      navigate("/dashboard", {
        replace: true,
      })
    } catch (caughtError) {
      setError(
        caughtError instanceof ApiError
          ? caughtError.message
          : "ตั้งรหัสผ่านไม่สำเร็จ กรุณาลองใหม่อีกครั้ง",
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <main className="sign-in">
      <AuthShowcase
        title={
          <>
            อีกขั้นเดียว
            <br />
            ก็เริ่มใช้งานได้
          </>
        }
        description="ตั้งรหัสผ่านไว้ใช้เข้าสู่ระบบด้วยอีเมลได้ด้วย นอกเหนือจาก Google"
      />

      <section className="sign-in__form-side">
        <div className="sign-in__card">
          <div className="sign-in__icon">
            <KeyRound size={28} />
          </div>

          <div className="sign-in__heading">
            <h2>ตั้งรหัสผ่าน</h2>

            <p>
              บัญชี <strong>{user?.email}</strong>{" "}
              ยังไม่มีรหัสผ่าน
              กรุณาตั้งก่อนเริ่มใช้งาน
            </p>
          </div>

          <form
            className="sign-in__form"
            onSubmit={handleSubmit}
            noValidate
          >
            <Input
              id="new-password"
              type="password"
              label="รหัสผ่านใหม่"
              placeholder="กรอกรหัสผ่าน"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(event.target.value)
              }}
            />

            <PasswordRequirements
              password={password}
            />

            <Input
              id="confirm-password"
              type="password"
              label="ยืนยันรหัสผ่าน"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              autoComplete="new-password"
              value={confirmPassword}
              error={
                confirmPassword.length >= password.length &&
                confirmPassword !== password
                  ? "รหัสผ่านไม่ตรงกัน"
                  : undefined
              }
              onChange={(event) => {
                setConfirmPassword(event.target.value)
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
              ตั้งรหัสผ่านและเริ่มใช้งาน
            </Button>
          </form>

          <p className="sign-in__register">
            ไม่ใช่บัญชีของคุณ?{" "}
            <button
              type="button"
              className="sign-in__text-button"
              onClick={() => {
                logout()
                navigate("/sign-in", { replace: true })
              }}
            >
              ออกจากระบบ
            </button>
          </p>
        </div>
      </section>
    </main>
  )
}
