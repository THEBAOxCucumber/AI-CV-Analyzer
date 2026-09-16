import type {
  InputHTMLAttributes,
} from "react"

import "./Input.css"

interface InputProps
  extends InputHTMLAttributes<HTMLInputElement> {
  label: string
  error?: string
}

export function Input({
  label,
  error,
  id,
  className = "",
  ...props
}: InputProps) {
  return (
    <div className="input-field">
      <label
        className="input-field__label"
        htmlFor={id}
      >
        {label}
      </label>

      <input
        {...props}
        id={id}
        className={[
          "input-field__input",
          error
            ? "input-field__input--error"
            : "",
          className,
        ]
          .filter(Boolean)
          .join(" ")}
      />

      {error && (
        <p
          className="input-field__error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  )
}