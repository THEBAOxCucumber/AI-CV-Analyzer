import type {
  ReactNode,
} from "react"

import {
  Navigate,
  useLocation,
} from "react-router-dom"

import {
  useAuth,
} from "../../hooks/useAuth"

interface ProtectedRouteProps {
  children: ReactNode
}

export function ProtectedRoute({
  children,
}: ProtectedRouteProps) {
  const {
    user,
    isAuthenticated,
    isLoading,
  } = useAuth()

  const location = useLocation()

  if (isLoading) {
    return (
      <main className="auth-loading">
        กำลังตรวจสอบการเข้าสู่ระบบ...
      </main>
    )
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/sign-in"
        replace
        state={{
          from: location.pathname,
        }}
      />
    )
  }

  /*
   * บัญชีจาก Google ที่ยังไม่มีรหัสผ่าน → ต้องตั้งก่อนเข้าหน้าอื่น
   */
  if (
    user?.needsPassword &&
    location.pathname !== "/set-password"
  ) {
    return (
      <Navigate
        to="/set-password"
        replace
      />
    )
  }

  return <>{children}</>
}