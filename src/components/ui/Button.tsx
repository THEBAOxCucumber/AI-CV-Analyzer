import type {
  ButtonHTMLAttributes,
  ReactNode,
} from "react"

import "../../styles/components/Button.css"

interface ButtonProps
  extends ButtonHTMLAttributes<HTMLButtonElement> {
  children: ReactNode
  variant?: "primary" | "secondary"
  fullWidth?: boolean
  loading?: boolean
}

export function Button({
  children,
  variant = "primary",
  fullWidth = false,
  loading = false,
  disabled,
  className = "",
  ...props
}: ButtonProps) {
  const classes = [
    "button",
    `button--${variant}`,
    fullWidth ? "button--full" : "",
    className,
  ]
    .filter(Boolean)
    .join(" ")

  return (
    <button
      {...props}
      className={classes}
      disabled={disabled || loading}
    >
      {loading ? "กำลังดำเนินการ..." : children}
    </button>
  )
}