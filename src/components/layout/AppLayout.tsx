import {
  Outlet,
} from "react-router-dom"

import {
  Sidebar,
} from "./Sidebar"

import "../../styles/components/AppLayout.css"

export function AppLayout() {
  return (
    <div className="app-layout">
      <Sidebar />

      <div className="app-layout__main">
        <Outlet />
      </div>
    </div>
  )
}