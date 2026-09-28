import {
  Outlet,
} from "react-router-dom"

import {
  Sidebar,
} from "./Sidebar"

import {
  MobileTopbar,
} from "./MobileTopbar"

import "../../styles/components/AppLayout.css"

export function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout__main">
        {/*
          * แสดงเฉพาะ ≤900px (CSS)
          */}
        <MobileTopbar />

        <Outlet />
      </div>
    </div>
  )
}