import {
  useState,
  type FormEvent,
} from "react"

import {
  Link,
  Navigate,
  useNavigate,
} from "react-router-dom"

import {
  FileText,
  UserPlus,
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
  register,
} from "../services/auth.service"

import {
  useAuth,
} from "../hooks/useAuth"

import "../styles/pages/SignInPage.css"

export function RegisterPage() {
  const navigate = useNavigate()

  const {
    isAuthenticated,
    isLoading: isAuthLoading,
  } = useAuth()

  const [firstName, setFirstName] =
    useState("")

  const [lastName, setLastName] =
    useState("")

  const [email, setEmail] =
    useState("")

  const [password, setPassword] =
    useState("")

  const [confirmPassword, setConfirmPassword] =
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

    const normalizedFirstName =
      firstName.trim()

    const normalizedLastName =
      lastName.trim()

    const normalizedEmail =
      email.trim().toLowerCase()

    if (
      !normalizedFirstName ||
      !normalizedLastName ||
      !normalizedEmail ||
      !password ||
      !confirmPassword
    ) {
      setError("กรุณากรอกข้อมูลให้ครบถ้วน")
      return
    }

    if (password.length < 8) {
      setError(
        "รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร",
      )
      return
    }

    if (!/[A-Z]/.test(password)) {
      setError(
        "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวใหญ่อย่างน้อย 1 ตัว",
      )
      return
    }

    if (!/[a-z]/.test(password)) {
      setError(
        "รหัสผ่านต้องมีตัวอักษรภาษาอังกฤษตัวเล็กอย่างน้อย 1 ตัว",
      )
      return
    }

    if (!/[0-9]/.test(password)) {
      setError(
        "รหัสผ่านต้องมีตัวเลขอย่างน้อย 1 ตัว",
      )
      return
    }

    if (password !== confirmPassword) {
      setError("รหัสผ่านไม่ตรงกัน")
      return
    }

    setIsSubmitting(true)

    try {
      await register({
        firstName: normalizedFirstName,
        lastName: normalizedLastName,
        email: normalizedEmail,
        password,
      })

      navigate(
        "/sign-in",
        {
          replace: true,
          state: {
            registrationSuccess: true,
          },
        },
      )
    } catch (caughtError) {
      if (
        caughtError instanceof ApiError
      ) {
        if (
          caughtError.code ===
          "EMAIL_ALREADY_EXISTS"
        ) {
          setError(
            "อีเมลนี้ถูกใช้งานแล้ว",
          )
        } else {
          setError(
            caughtError.message,
          )
        }
      } else {
        setError(
          "ไม่สามารถสมัครสมาชิกได้ กรุณาลองใหม่อีกครั้ง",
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
            เริ่มพัฒนา Resume
            <br />
            เพื่อโอกาสในการทำงาน
            <br />
            ที่ดียิ่งขึ้น
          </h1>

          <p>
            สมัครสมาชิกเพื่อวิเคราะห์ Resume
            ค้นหาจุดแข็ง จุดที่ควรปรับปรุง
            และเปรียบเทียบกับตำแหน่งงานที่คุณสนใจ
          </p>
        </div>
      </section>

      <section className="sign-in__form-side">
        <div className="sign-in__card">
          <div className="sign-in__icon">
            <UserPlus size={28} />
          </div>

          <div className="sign-in__heading">
            <h2>
              สมัครสมาชิก
            </h2>

            <p>
              สร้างบัญชีเพื่อเริ่มใช้งาน AI Resume
            </p>
          </div>

          <form
            className="sign-in__form"
            onSubmit={handleSubmit}
          >
            <Input
              id="firstName"
              type="text"
              label="ชื่อ"
              placeholder="กรอกชื่อ"
              autoComplete="given-name"
              value={firstName}
              onChange={(event) => {
                setFirstName(
                  event.target.value,
                )
              }}
            />

            <Input
              id="lastName"
              type="text"
              label="นามสกุล"
              placeholder="กรอกนามสกุล"
              autoComplete="family-name"
              value={lastName}
              onChange={(event) => {
                setLastName(
                  event.target.value,
                )
              }}
            />

            <Input
              id="register-email"
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
              id="register-password"
              type="password"
              label="รหัสผ่าน"
              placeholder="อย่างน้อย 8 ตัวอักษร"
              autoComplete="new-password"
              value={password}
              onChange={(event) => {
                setPassword(
                  event.target.value,
                )
              }}
            />

            <Input
              id="confirm-password"
              type="password"
              label="ยืนยันรหัสผ่าน"
              placeholder="กรอกรหัสผ่านอีกครั้ง"
              autoComplete="new-password"
              value={confirmPassword}
              onChange={(event) => {
                setConfirmPassword(
                  event.target.value,
                )
              }}
            />

            <p className="sign-in__password-hint">
              รหัสผ่านต้องมีอย่างน้อย 8 ตัวอักษร
              และมีตัวพิมพ์ใหญ่ ตัวพิมพ์เล็ก และตัวเลข
            </p>

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
              สมัครสมาชิก
            </Button>
          </form>

          <p className="sign-in__register">
            มีบัญชีอยู่แล้ว?{" "}
            <Link
              className="sign-in__register-link"
              to="/sign-in"
            >
              เข้าสู่ระบบ
            </Link>
          </p>
        </div>
      </section>
    </main>
  )
}