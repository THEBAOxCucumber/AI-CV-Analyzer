import {
  BarChart3,
  BriefcaseBusiness,
  History,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  RotateCw,
  Settings,
  Sun,
  Upload,
  X,
  type LucideIcon,
} from "lucide-react"

import {
  useEffect,
  useRef,
} from "react"

import {
  NavLink,
  useNavigate,
} from "react-router-dom"

import {
  useAuth,
} from "../../hooks/useAuth"

import {
  useExtendSession,
} from "../../hooks/useExtendSession"

import {
  useTheme,
} from "../../hooks/useTheme"

import {
  SESSION_WARNING_SECONDS,
  formatSessionTime,
  getInitials,
} from "../../utils/session"

import logoBlue from "../../assets/brand/logo-blue.png"
import logoWhite from "../../assets/brand/logo-white.png"
import markBlue from "../../assets/brand/mark-blue.png"
import markWhite from "../../assets/brand/mark-white.png"

import "../../styles/components/Sidebar.css"

interface NavigationItem {
  to: string
  label: string
  icon: LucideIcon
}

const mainNavigation: NavigationItem[] = [
  {
    to: "/dashboard",
    label: "Dashboard",
    icon: LayoutDashboard,
  },
  {
    to: "/resumes/upload",
    label: "อัปโหลด Resume",
    icon: Upload,
  },
  {
    to: "/history",
    label: "ประวัติ",
    icon: History,
  },
  {
    to: "/insights",
    label: "ข้อมูลเชิงลึก",
    icon: BarChart3,
  },
  {
    to: "/jobs",
    label: "หางาน",
    icon: BriefcaseBusiness,
  },
]

const accountNavigation: NavigationItem[] = [
  {
    to: "/settings",
    label: "ตั้งค่า",
    icon: Settings,
  },
]

function NavigationLink({
  to,
  label,
  icon: Icon,
  collapsed,
}: NavigationItem & {
  collapsed: boolean
}) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? "sidebar__link sidebar__link--active"
          : "sidebar__link"
      }
      // ย่อแล้วเหลือแต่ไอคอน → ชี้แล้วเห็นชื่อ (ชื่อจริงยังอยู่ใน DOM ให้ screen reader)
      title={collapsed ? label : undefined}
    >
      <span className="sidebar__link-icon">
        <Icon size={19} />
      </span>

      <span className="sidebar__link-label">
        {label}
      </span>
    </NavLink>
  )
}

/*
 * จอคอม: แถบซ้าย ย่อ/ขยายด้วยปุ่ม ☰ (collapsed = เหลือไอคอน)
 * ≤900px: เมนูเลื่อนออกจากซ้าย (mobileOpen) — ปิดด้วย ✕ / แตะพื้นหลัง / Esc / เลือกเมนู
 */
export function Sidebar({
  collapsed,
  onToggleCollapsed,
  mobileOpen,
  onCloseMobile,
}: {
  collapsed: boolean
  onToggleCollapsed: () => void
  mobileOpen: boolean
  onCloseMobile: () => void
}) {
  const {
    user,
    logout,
    sessionRemainingSeconds,
  } = useAuth()

  const {
    isExtending,
    handleExtendSession,
  } = useExtendSession()

  const navigate = useNavigate()

  const {
    resolvedTheme,
    toggleTheme,
  } = useTheme()

  const closeButtonRef =
    useRef<HTMLButtonElement>(null)

  /*
   * เปิดเมนูมือถือ: focus ปุ่มปิด + Esc ปิด
   */
  useEffect(() => {
    if (!mobileOpen) {
      return
    }

    closeButtonRef.current?.focus()

    function handleKeyDown(
      event: KeyboardEvent,
    ) {
      if (event.key === "Escape") {
        onCloseMobile()
      }
    }

    document.addEventListener("keydown", handleKeyDown)

    return () => {
      document.removeEventListener("keydown", handleKeyDown)
    }
  }, [mobileOpen, onCloseMobile])

  const themeToggleLabel =
    resolvedTheme === "dark"
      ? "เปลี่ยนเป็นโหมดสว่าง"
      : "เปลี่ยนเป็นโหมดมืด"

  const collapseLabel = collapsed
    ? "ขยายเมนู"
    : "ย่อเมนู"

  function handleLogout() {
    logout()

    navigate("/sign-in", {
      replace: true,
    })
  }

  const isSessionEnding =
    sessionRemainingSeconds <=
    SESSION_WARNING_SECONDS

  const isDark = resolvedTheme === "dark"

  const classes = [
    "sidebar",
    collapsed ? "sidebar--collapsed" : "",
    mobileOpen ? "sidebar--open" : "",
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <>
      {/* พื้นหลังมืดหลังเมนูมือถือ — แตะเพื่อปิด */}
      <div
        className={
          mobileOpen
            ? "sidebar-backdrop sidebar-backdrop--visible"
            : "sidebar-backdrop"
        }
        onClick={onCloseMobile}
        aria-hidden="true"
      />

      <aside
        id="app-sidebar"
        className={classes}
        aria-label="เมนู"
      >
        <div className="sidebar__top">
          <NavLink
            to="/dashboard"
            className="sidebar__brand"
            aria-label="AI Resume Analyzer — ไปที่ Dashboard"
          >
            <img
              className="sidebar__logo"
              src={isDark ? logoWhite : logoBlue}
              alt="AI Resume Analyzer"
              width={480}
              height={208}
            />

            <img
              className="sidebar__mark"
              src={isDark ? markWhite : markBlue}
              alt=""
              width={64}
              height={64}
            />
          </NavLink>

          {/* จอคอม: ย่อ/ขยาย */}
          <button
            type="button"
            className="sidebar__collapse"
            onClick={onToggleCollapsed}
            aria-label={collapseLabel}
            aria-expanded={!collapsed}
            title={collapseLabel}
          >
            <Menu size={20} />
          </button>

          {/* มือถือ: ปิดเมนู */}
          <button
            ref={closeButtonRef}
            type="button"
            className="sidebar__close"
            onClick={onCloseMobile}
            aria-label="ปิดเมนู"
          >
            <X size={20} />
          </button>
        </div>

        <nav
          className="sidebar__navigation"
          aria-label="เมนูหลัก"
        >
          <p className="sidebar__group-label">
            เมนูหลัก
          </p>

          {mainNavigation.map((item) => (
            <NavigationLink
              key={item.to}
              {...item}
              collapsed={collapsed}
            />
          ))}

          <p className="sidebar__group-label">
            บัญชี
          </p>

          {accountNavigation.map((item) => (
            <NavigationLink
              key={item.to}
              {...item}
              collapsed={collapsed}
            />
          ))}
        </nav>

        <div className="sidebar__footer">
          <div className="sidebar__footer-row">
            <button
              type="button"
              className={
                isSessionEnding
                  ? "sidebar__session sidebar__session--warning"
                  : "sidebar__session"
              }
              onClick={handleExtendSession}
              disabled={isExtending}
              aria-label={`ต่ออายุเซสชัน (เหลือ ${formatSessionTime(sessionRemainingSeconds)})`}
              title="กดเพื่อต่ออายุเซสชัน"
            >
              <RotateCw
                size={15}
                aria-hidden="true"
                className={isExtending ? "session-spin" : undefined}
              />

              <span className="sidebar__session-label">เซสชัน</span>

              <strong>
                {formatSessionTime(
                  sessionRemainingSeconds,
                )}
              </strong>
            </button>

            <button
              type="button"
              className="sidebar__theme"
              onClick={toggleTheme}
              aria-label={themeToggleLabel}
              title={themeToggleLabel}
            >
              {isDark
                ? <Sun size={17} />
                : <Moon size={17} />}
            </button>
          </div>

          <div className="sidebar__user">
            <div
              className="sidebar__avatar"
              title={
                collapsed
                  ? `${user?.firstName ?? ""} ${user?.lastName ?? ""}`.trim()
                  : undefined
              }
            >
              {getInitials(
                user?.firstName,
                user?.lastName,
              )}
            </div>

            <div className="sidebar__user-info">
              <strong>
                {user?.firstName}{" "}
                {user?.lastName}
              </strong>

              <span>{user?.email}</span>
            </div>

            <button
              type="button"
              className="sidebar__logout"
              onClick={handleLogout}
              aria-label="ออกจากระบบ"
              title="ออกจากระบบ"
            >
              <LogOut size={18} />
            </button>
          </div>
        </div>
      </aside>
    </>
  )
}
