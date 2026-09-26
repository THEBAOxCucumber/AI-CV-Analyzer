import {
  useEffect,
  useState,
  type FormEvent,
} from "react"

import {
  Link,
  Navigate,
} from "react-router-dom"

import {
  CircleCheck,
  FileText,
  KeyRound,
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
  forgotPassword,
  resetPassword,
} from "../services/auth.service"

import {
  useAuth,
} from "../hooks/useAuth"

import "../styles/pages/SignInPage.css"

/*
 * ตรงกับ PASSWORD_RESET_RESEND_COOLDOWN_SECONDS
 * ของ backend
 */
const RESEND_COOLDOWN_SECONDS = 60

type Step =
  | "email"
  | "reset"
  | "done"

function getErrorMessage(
  error: unknown,
  fallback: string,
): string {
  return error instanceof ApiError
    ? error.message
    : fallback
}

export function ForgotPasswordPage() {
  const {
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth()

  const [step, setStep] =
    useState<Step>("email")

  const [email, setEmail] =
    useState("")

  const [otp, setOtp] =
    useState("")

  const [newPassword, setNewPassword] =
    useState("")

  const [confirmPassword, setConfirmPassword] =
    useState("")

  const [error, setError] =
    useState("")

  const [isSubmitting, setIsSubmitting] =
    useState(false)

  const [cooldown, setCooldown] =
    useState(0)

  useEffect(() => {
    if (cooldown <= 0) {
      return
    }

    const timeoutId = setTimeout(
      () => {
        setCooldown((seconds) => seconds - 1)
      },
      1000,
    )

    return () => {
      clearTimeout(timeoutId)
    }
  }, [cooldown])

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

  async function sendOtp(): Promise<boolean> {
    try {
      setIsSubmitting(true)
      setError("")

      await forgotPassword(
        email.trim().toLowerCase(),
      )

      setCooldown(RESEND_COOLDOWN_SECONDS)

      return true
    } catch (requestError) {
      setError(
        getErrorMessage(
          requestError,
          "ไม่สามารถส่งรหัส OTP ได้ กรุณาลองใหม่อีกครั้ง",
        ),
      )

      return false
    } finally {
      setIsSubmitting(false)
    }
  }

  async function handleRequestOtp(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()

    if (!email.trim()) {
      setError("กรุณากรอกอีเมล")
      return
    }

    if (await sendOtp()) {
      setStep("reset")
    }
  }

  async function handleResendOtp() {
    setOtp("")

    await sendOtp()
  }

  async function handleResetPassword(
    event: FormEvent<HTMLFormElement>,
  ) {
    event.preventDefault()
    setError("")

    if (!/^\d{6}$/.test(otp)) {
      setError("รหัส OTP ต้องเป็นตัวเลข 6 หลัก")
      return
    }

    if (newPassword !== confirmPassword) {
      setError(
        "รหัสผ่านใหม่และการยืนยันรหัสผ่านไม่ตรงกัน",
      )
      return
    }

    try {
      setIsSubmitting(true)

      await resetPassword({
        email: email.trim().toLowerCase(),
        otp,
        newPassword,
      })

      setStep("done")
    } catch (resetError) {
      setError(
        getErrorMessage(
          resetError,
          "ไม่สามารถตั้งรหัสผ่านใหม่ได้ กรุณาลองใหม่อีกครั้ง",
        ),
      )
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
            ลืมรหัสผ่าน?
            <br />
            ไม่ต้องกังวล
          </h1>

          <p>
            ยืนยันตัวตนด้วยรหัส OTP
            ที่ส่งไปยังอีเมลของคุณ
            แล้วตั้งรหัสผ่านใหม่ได้ทันที
          </p>
        </div>
      </section>

      <section className="sign-in__form-side">
        <div className="sign-in__card">
          <div className="sign-in__icon">
            {step === "done" ? (
              <CircleCheck size={28} />
            ) : (
              <KeyRound size={28} />
            )}
          </div>

          {step === "email" && (
            <>
              <div className="sign-in__heading">
                <h2>
                  ลืมรหัสผ่าน
                </h2>

                <p>
                  กรอกอีเมลที่ใช้สมัครสมาชิก
                  เราจะส่งรหัส OTP 6 หลักไปให้
                </p>
              </div>

              <form
                className="sign-in__form"
                onSubmit={(event) => {
                  void handleRequestOtp(event)
                }}
              >
                <Input
                  id="email"
                  type="email"
                  label="อีเมล"
                  placeholder="name@example.com"
                  autoComplete="email"
                  value={email}
                  onChange={(event) => {
                    setEmail(event.target.value)
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
                  ส่งรหัส OTP
                </Button>
              </form>
            </>
          )}

          {step === "reset" && (
            <>
              <div className="sign-in__heading">
                <h2>
                  ตั้งรหัสผ่านใหม่
                </h2>

                <p>
                  หากอีเมล{" "}
                  <strong>{email.trim()}</strong>{" "}
                  มีบัญชีอยู่ในระบบ
                  เราได้ส่งรหัส OTP ไปแล้ว
                  (หมดอายุใน 10 นาที){" "}
                  <button
                    type="button"
                    className="sign-in__text-button"
                    onClick={() => {
                      setStep("email")
                      setError("")
                      setOtp("")
                    }}
                  >
                    เปลี่ยนอีเมล
                  </button>
                </p>
              </div>

              <form
                className="sign-in__form"
                onSubmit={(event) => {
                  void handleResetPassword(event)
                }}
              >
                <Input
                  id="otp"
                  label="รหัส OTP"
                  placeholder="6 หลัก"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={otp}
                  onChange={(event) => {
                    setOtp(
                      event.target.value.replace(
                        /\D/g,
                        "",
                      ),
                    )
                  }}
                />

                <Input
                  id="new-password"
                  type="password"
                  label="รหัสผ่านใหม่"
                  autoComplete="new-password"
                  maxLength={72}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value)
                  }}
                />

                <p className="sign-in__password-hint">
                  อย่างน้อย 8 ตัว มีตัวพิมพ์ใหญ่
                  ตัวพิมพ์เล็ก และตัวเลข
                </p>

                <Input
                  id="confirm-password"
                  type="password"
                  label="ยืนยันรหัสผ่านใหม่"
                  autoComplete="new-password"
                  maxLength={72}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(
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
                  ตั้งรหัสผ่านใหม่
                </Button>
              </form>

              <p className="sign-in__register">
                ไม่ได้รับอีเมล?{" "}
                <button
                  type="button"
                  className="sign-in__text-button"
                  disabled={
                    cooldown > 0 ||
                    isSubmitting
                  }
                  onClick={() => {
                    void handleResendOtp()
                  }}
                >
                  {cooldown > 0
                    ? `ส่งรหัสอีกครั้ง (${cooldown} วินาที)`
                    : "ส่งรหัสอีกครั้ง"}
                </button>
              </p>
            </>
          )}

          {step === "done" && (
            <>
              <div className="sign-in__heading">
                <h2>
                  ตั้งรหัสผ่านใหม่สำเร็จ
                </h2>

                <p className="sign-in__success">
                  ใช้รหัสผ่านใหม่เข้าสู่ระบบได้ทันที
                  เราได้ส่งอีเมลแจ้งเตือนการเปลี่ยนรหัสผ่านไปแล้ว
                </p>
              </div>

              <div className="sign-in__form">
                <Link
                  className="button button--primary button--full"
                  to="/sign-in"
                >
                  ไปหน้าเข้าสู่ระบบ
                </Link>
              </div>
            </>
          )}

          {step !== "done" && (
            <p className="sign-in__register">
              <Link
                className="sign-in__register-link"
                to="/sign-in"
              >
                ← กลับไปหน้าเข้าสู่ระบบ
              </Link>
            </p>
          )}
        </div>
      </section>
    </main>
  )
}
