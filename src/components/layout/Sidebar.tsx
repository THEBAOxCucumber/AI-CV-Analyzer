import {
  BarChart3,
  BriefcaseBusiness,
  Clock3,
  History,
  LayoutDashboard,
  LogOut,
  Moon,
  Settings,
  Sun,
  Upload,
  type LucideIcon,
} from "lucide-react"

import {
  NavLink,
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

import logoWhite from "../../assets/brand/logo-white.png"

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
    label: "Upload Resume",
    icon: Upload,
  },
  {
    to: "/history",
    label: "History",
    icon: History,
  },
  {
    to: "/insights",
    label: "Insights",
    icon: BarChart3,
  },
  {
    to: "/jobs",
    label: "Job Matches",
    icon: BriefcaseBusiness,
  },
]

const accountNavigation: NavigationItem[] = [
  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
  },
]

function NavigationLink({
  to,
  label,
  icon: Icon,
}: NavigationItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        isActive
          ? "sidebar__link sidebar__link--active"
          : "sidebar__link"
      }
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

export function Sidebar() {
  const {
    user,
    logout,
    sessionRemainingSeconds,
  } = useAuth()

  const navigate = useNavigate()

  const {
    resolvedTheme,
    toggleTheme,
  } = useTheme()

  const themeToggleLabel =
    resolvedTheme === "dark"
      ? "เปลี่ยนเป็นโหมดสว่าง"
      : "เปลี่ยนเป็นโหมดมืด"

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
    <aside className="sidebar">
      <NavLink
        to="/dashboard"
        className="sidebar__brand"
        aria-label="AI Resume Analyzer — ไปที่ Dashboard"
      >
        <img
          className="sidebar__logo"
          src={logoWhite}
          alt="AI Resume Analyzer"
          width={480}
          height={208}
        />
      </NavLink>

      <nav
        className="sidebar__navigation"
        aria-label="Main navigation"
      >
        <p className="sidebar__group-label">
          เมนูหลัก
        </p>

        {mainNavigation.map((item) => (
          <NavigationLink
            key={item.to}
            {...item}
          />
        ))}

        <p className="sidebar__group-label">
          บัญชี
        </p>

        {accountNavigation.map((item) => (
          <NavigationLink
            key={item.to}
            {...item}
          />
        ))}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__footer-row">
          <div
            className={
              isSessionEnding
                ? "sidebar__session sidebar__session--warning"
                : "sidebar__session"
            }
            title="เวลาที่เหลือก่อนต้องเข้าสู่ระบบใหม่"
          >
            <Clock3 size={15} />

            <span>Session</span>

            <strong>
              {formatSessionTime(
                sessionRemainingSeconds,
              )}
            </strong>
          </div>

          <button
            type="button"
            className="sidebar__theme"
            onClick={toggleTheme}
            aria-label={themeToggleLabel}
            title={themeToggleLabel}
          >
            {resolvedTheme === "dark"
              ? <Sun size={17} />
              : <Moon size={17} />}
          </button>
        </div>

        <div className="sidebar__user">
          <div className="sidebar__avatar">
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
  )
}
