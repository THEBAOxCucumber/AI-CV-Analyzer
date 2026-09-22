import {
  BaggageClaimIcon,
  BarChart3,
  FileClock,
  FileText,
  LayoutDashboard,
  LogOut,
  Settings,
  Upload,
} from "lucide-react"

import {
  NavLink,
  useNavigate,
} from "react-router-dom"

import {
  useAuth,
} from "../../hooks/useAuth"

import "../../styles/components/Sidebar.css"

const navigation = [
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
    icon: FileClock,
  },
  {
    to: "/insights",
    label: "Insights",
    icon: BarChart3,
  },
  {
    to: "/jobs",
    label: "Job Matches",
    icon: BaggageClaimIcon,
  },

  {
    to: "/settings",
    label: "Settings",
    icon: Settings,
  },
]

function formatSessionTime(
  totalSeconds: number,
): string {
  const minutes =
    Math.floor(totalSeconds / 60)

  const seconds =
    totalSeconds % 60

  return `${String(minutes).padStart(
    2,
    "0",
  )}:${String(seconds).padStart(
    2,
    "0",
  )}`
}

export function Sidebar() {
  const {
    user,
    logout,
    sessionRemainingSeconds,
  } = useAuth()

  const navigate = useNavigate()

  function handleLogout() {
    logout()

    navigate(
      "/sign-in",
      {
        replace: true,
      },
    )
  }

  const initials = [
    user?.firstName?.[0],
    user?.lastName?.[0],
  ]
    .filter(Boolean)
    .join("")
    .toUpperCase()

  return (
    <aside className="sidebar">
      <div className="sidebar__brand">
        <div className="sidebar__brand-icon">
          <FileText size={23} />
        </div>

        <div>
          <strong>
            AI Resume
          </strong>

          <span>
            Analyzer
          </span>
        </div>
      </div>

      <nav
        className="sidebar__navigation"
        aria-label="Main navigation"
      >
        {navigation.map(
          ({
            to,
            label,
            icon: Icon,
          }) => (
            <NavLink
              key={to}
              to={to}
              className={({
                isActive,
              }) =>
                [
                  "sidebar__link",
                  isActive
                    ? "sidebar__link--active"
                    : "",
                ]
                  .filter(Boolean)
                  .join(" ")
              }
            >
              <Icon size={20} />

              <span>
                {label}
              </span>
            </NavLink>
          ),
        )}
      </nav>

      <div className="sidebar__footer">
        <div className="sidebar__session">
          <span>
            เวลาการเข้าสู่ระบบ
          </span>

          <strong>
            {formatSessionTime(
              sessionRemainingSeconds,
            )}
          </strong>
        </div>
        <div className="sidebar__user">
          <div className="sidebar__avatar">
            {initials || "U"}
          </div>

          <div className="sidebar__user-info">
            <strong>
              {user?.firstName}{" "}
              {user?.lastName}
            </strong>

            <span>
              {user?.email}
            </span>
          </div>
        </div>

        <button
          type="button"
          className="sidebar__logout"
          onClick={handleLogout}
        >
          <LogOut size={19} />
          <span>ออกจากระบบ</span>
        </button>
      </div>
    </aside>
  )
}