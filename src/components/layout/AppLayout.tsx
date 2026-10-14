import {
  useCallback,
  useState,
} from "react"

import {
  Outlet,
  useLocation,
} from "react-router-dom"

import {
  Sidebar,
} from "./Sidebar"

import {
  MobileTopbar,
} from "./MobileTopbar"

import "../../styles/components/AppLayout.css"

/*
 * จอคอม: ย่อเมนูซ้ายเหลือไอคอน (จำค่าไว้ในเบราว์เซอร์)
 */
const SIDEBAR_COLLAPSED_KEY = "ai-cv-sidebar-collapsed"

function readCollapsed(): boolean {
  try {
    return localStorage.getItem(SIDEBAR_COLLAPSED_KEY) === "1"
  } catch {
    return false
  }
}

export function AppLayout() {
  const location = useLocation()

  const [collapsed, setCollapsed] =
    useState(readCollapsed)

  /*
   * มือถือ: เมนูเปิดค้างเฉพาะหน้าที่กดเปิด
   * เปลี่ยนหน้า (pathname เปลี่ยน) = ปิดเอง ไม่ต้องใช้ effect
   */
  const [menuOpenOnPath, setMenuOpenOnPath] =
    useState<string | null>(null)

  const isMenuOpen =
    menuOpenOnPath === location.pathname

  function toggleCollapsed() {
    setCollapsed((current) => {
      const next = !current

      try {
        localStorage.setItem(SIDEBAR_COLLAPSED_KEY, next ? "1" : "0")
      } catch {
        /* ใช้ได้เฉพาะครั้งนี้ */
      }

      return next
    })
  }

  const closeMenu = useCallback(() => {
    setMenuOpenOnPath(null)

    // คืน focus ให้ปุ่ม ☰ ที่เปิดเมนู
    document.getElementById("menu-toggle")?.focus()
  }, [])

  return (
    <div
      className={
        collapsed
          ? "app-layout app-layout--collapsed"
          : "app-layout"
      }
    >
      <Sidebar
        collapsed={collapsed}
        onToggleCollapsed={toggleCollapsed}
        mobileOpen={isMenuOpen}
        onCloseMobile={closeMenu}
      />

      <div className="app-layout__main">
        {/*
          * แสดงเฉพาะ ≤900px (CSS)
          */}
        <MobileTopbar
          menuOpen={isMenuOpen}
          onOpenMenu={() => setMenuOpenOnPath(location.pathname)}
        />

        {/*
          * key ตาม path → เปลี่ยนหน้าแล้วเล่น animation ใหม่
          */}
        <div
          key={location.pathname}
          className="page-transition"
        >
          <Outlet />
        </div>
      </div>
    </div>
  )
}
