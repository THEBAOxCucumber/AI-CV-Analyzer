import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react"

import {
  LoaderCircle,
} from "lucide-react"

import "../../styles/components/Button.css"

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: "primary" | "secondary" | "ghost" | "danger"
  size?: "md" | "sm"
  fullWidth?: boolean
  loading?: boolean
}

/*
 * loading: แสดง spinner คู่กับข้อความเดิม (ปุ่มไม่เปลี่ยนขนาด)
 */
export function Button({
  children,
  variant = "primary",
  size = "md",
  fullWidth = false,
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    "button",
    `button--${variant}`,
    size === "sm" ? "button--sm" : "",
    fullWidth ? "button--full" : "",
    loading ? "button--loading" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <button
      {...props}
      className={classes}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
    >
      {loading && (
        <LoaderCircle
          className="button__spinner"
          size={18}
          aria-hidden="true"
        />
      )}
      {children}
    </button>
  )
}
