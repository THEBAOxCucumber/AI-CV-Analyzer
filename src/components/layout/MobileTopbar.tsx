import {
  Clock3,
  LogOut,
  Moon,
  Settings,
  Sun,
} from "lucide-react"

import logoBlue from "../../assets/brand/logo-blue.png"
import logoWhite from "../../assets/brand/logo-white.png"

import {
  useEffect,
  useRef,
  useState,
} from "react"

import {
  Link,
  useLocation,
  useNavigate,
} from "react-router-dom"

import {
  useAuth,
} from "../../hooks/useAuth"

import {
  useTheme,
} from "../../hooks/useTheme"

import {
  SESSION_WARNING_SECONDS,
  formatSessionTime,
  getInitials,
} from "../../utils/session"

/*
 * แถบบนสำหรับ ≤900px (sidebar กลายเป็นแถบล่าง)
 * มีเมนูผู้ใช้ + ออกจากระบบ ที่ sidebar ซ่อนไป
 */
export function MobileTopbar() {
  const {
    user,
    logout,
    sessionRemainingSeconds,
  } = useAuth()

  const navigate = useNavigate()
  const location = useLocation()

  const {
    resolvedTheme,
    toggleTheme,
  } = useTheme()

  const themeToggleLabel =
    resolvedTheme === "dark"
      ? "เปลี่ยนเป็นโหมดสว่าง"
      : "เปลี่ยนเป็นโหมดมืด"

  const [isMenuOpen, setIsMenuOpen] =
    useState(false)

  const menuRef =
    useRef<HTMLDivElement>(null)

  /*
   * เปลี่ยนหน้าแล้วปิดเมนู
   */
  const [lastPath, setLastPath] =
    useState(location.pathname)

  if (location.pathname !== lastPath) {
    setLastPath(location.pathname)
    setIsMenuOpen(false)
  }

  useEffect(() => {
    if (!isMenuOpen) {
      return
    }

    function handlePointerDown(
      event: PointerEvent,
    ) {
      if (
        menuRef.current &&
        !menuRef.current.contains(
          event.target as Node,
        )
      ) {
        setIsMenuOpen(false)
      }
    }

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        setIsMenuOpen(false)
      }
    }

    document.addEventListener(
      "pointerdown",
      handlePointerDown,
    )
    document.addEventListener(
      "keydown",
      handleKeyDown,
    )

    return () => {
      document.removeEventListener(
        "pointerdown",
        handlePointerDown,
      )
      document.removeEventListener(
        "keydown",
        handleKeyDown,
      )
    }
  }, [isMenuOpen])

  function handleLogout() {
    logout()

    navigate("/sign-in", {
      replace: true,
    })
  }

  const isSessionEnding =
    sessionRemainingSeconds <=
    SESSION_WARNING_SECONDS

  return (
    <header className="mobile-topbar">
      <Link
        to="/dashboard"
        className="mobile-topbar__brand"
        aria-label="AI Resume Analyzer — ไปที่ Dashboard"
      >
        <img
          className="mobile-topbar__logo"
          src={
            resolvedTheme === "dark"
              ? logoWhite
              : logoBlue
          }
          alt="AI Resume Analyzer"
          width={480}
          height={208}
        />
      </Link>

      <div className="mobile-topbar__actions">
        <span
          className={
            isSessionEnding
              ? "mobile-topbar__session mobile-topbar__session--warning"
              : "mobile-topbar__session"
          }
          title="เวลาที่เหลือก่อนต้องเข้าสู่ระบบใหม่"
        >
          <Clock3 size={14} />
          {formatSessionTime(
            sessionRemainingSeconds,
          )}
        </span>

        <button
          type="button"
          className="mobile-topbar__theme"
          onClick={toggleTheme}
          aria-label={themeToggleLabel}
          title={themeToggleLabel}
        >
          {resolvedTheme === "dark"
            ? <Sun size={18} />
            : <Moon size={18} />}
        </button>

        <div
          className="mobile-topbar__menu"
          ref={menuRef}
        >
          <button
            type="button"
            className="mobile-topbar__avatar"
            aria-label="เมนูผู้ใช้"
            aria-haspopup="menu"
            aria-expanded={isMenuOpen}
            onClick={() =>
              setIsMenuOpen((open) => !open)
            }
          >
            {getInitials(
              user?.firstName,
              user?.lastName,
            )}
          </button>

          {isMenuOpen && (
            <div
              className="mobile-topbar__dropdown"
              role="menu"
            >
              <div className="mobile-topbar__user">
                <strong>
                  {user?.firstName}{" "}
                  {user?.lastName}
                </strong>

                <span>{user?.email}</span>
              </div>

              <Link
                to="/settings"
                role="menuitem"
                className="mobile-topbar__item"
              >
                <Settings size={17} />
                Settings
              </Link>

              <button
                type="button"
                role="menuitem"
                className="mobile-topbar__item mobile-topbar__item--danger"
                onClick={handleLogout}
              >
                <LogOut size={17} />
                ออกจากระบบ
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  )
}
