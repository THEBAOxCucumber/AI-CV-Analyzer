import {
  useEffect,
  useState,
} from "react"

const screens = {
  sm: "640px",
  md: "768px",
  lg: "1024px",
  xl: "1280px",
  "2xl": "1536px",
} as const

type Breakpoint =
  keyof typeof screens

function getMatches(
  size: Breakpoint,
): boolean {
  if (
    typeof window ===
    "undefined"
  ) {
    return true
  }

  return window
    .matchMedia(
      `(min-width: ${screens[size]})`,
    )
    .matches
}

export function useBreakpoint(
  size: Breakpoint,
): boolean {
  const [matches, setMatches] =
    useState(
      () => getMatches(size),
    )

  useEffect(() => {
    const breakpoint =
      window.matchMedia(
        `(min-width: ${screens[size]})`,
      )

    const handleChange = (
      event: MediaQueryListEvent,
    ) => {
      setMatches(
        event.matches,
      )
    }

    breakpoint.addEventListener(
      "change",
      handleChange,
    )

    return () => {
      breakpoint.removeEventListener(
        "change",
        handleChange,
      )
    }
  }, [size])

  return matches
}