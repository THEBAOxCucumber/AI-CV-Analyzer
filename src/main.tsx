import {
  StrictMode,
} from "react"

import {
  createRoot,
} from "react-dom/client"

import {
  BrowserRouter,
} from "react-router-dom"

import App from "./App"
import {
  AuthProvider,
} from "./contexts/AuthProvider"

import {
  applyFontSize,
  getFontSize,
} from "./utils/appearance"

import "./index.css"

applyFontSize(getFontSize())

createRoot(
  document.getElementById("root")!,
).render(
  <StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
      </AuthProvider>
    </BrowserRouter>
  </StrictMode>,
)