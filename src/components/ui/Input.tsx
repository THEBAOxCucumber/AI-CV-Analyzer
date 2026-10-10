import {
  useState,
  type InputHTMLAttributes,
} from "react"

import {
  CircleAlert,
  Eye,
  EyeOff,
} from "lucide-react"

import "../../styles/components/Input.css"

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

/*
 * type="password" → มีปุ่มแสดง/ซ่อนรหัสผ่าน
 */
export function Input({
  label,
  error,
  id,
  type,
  className = "",
  ...props
}: InputProps) {
  const [isVisible, setIsVisible] =
    useState(false)

  const isPassword = type === "password"
  const errorId = error && id ? `${id}-error` : undefined

  return (
    <div className="input-field">
      <label
        className="input-field__label"
        htmlFor={id}
      >
        {label}
      </label>

      <div className="input-field__control">
        <input
          {...props}
          id={id}
          type={isPassword && isVisible ? "text" : type}
          aria-invalid={error ? true : undefined}
          aria-describedby={errorId}
          className={[
            "input-field__input",
            isPassword ? "input-field__input--with-action" : "",
            error
              ? "input-field__input--error"
              : "",
            className,
          ]
            .filter(Boolean)
            .join(" ")}
        />

        {isPassword && (
          <button
            type="button"
            className="input-field__action"
            onClick={() => setIsVisible((visible) => !visible)}
            aria-label={isVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
            aria-pressed={isVisible}
            title={isVisible ? "ซ่อนรหัสผ่าน" : "แสดงรหัสผ่าน"}
          >
            {isVisible
              ? <EyeOff size={18} />
              : <Eye size={18} />}
          </button>
        )}
      </div>

      {error && (
        <p
          id={errorId}
          className="input-field__error"
          role="alert"
        >
          <CircleAlert size={14} aria-hidden="true" />
          {error}
        </p>
      )}
    </div>
  )
}
