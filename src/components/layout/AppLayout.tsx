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

export function AppLayout() {
  const location = useLocation()

  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout__main">
        {/*
          * แสดงเฉพาะ ≤900px (CSS)
          */}
        <MobileTopbar />

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