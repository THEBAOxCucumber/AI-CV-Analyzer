const THAI_TIME_ZONE =
  "Asia/Bangkok"

function parseDate(
  value: string | number | Date,
): Date {
  if (value instanceof Date) {
    return value
  }

  if (typeof value === "number") {
    return new Date(value)
  }

  // MySQL datetime เช่น
  // 2026-09-22 13:30:00
  // ให้ถือว่าเป็น UTC
  const normalized =
    /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}$/.test(
      value,
    )
      ? `${value.replace(" ", "T")}Z`
      : value

  return new Date(normalized)
}

export function formatThaiDateTime(
  value: string | number | Date,
): string {
  const date = parseDate(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      timeZone: THAI_TIME_ZONE,
      year: "numeric",
      month: "short",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
  ).format(date)
}

export function formatThaiDate(
  value: string | number | Date,
): string {
  const date = parseDate(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      timeZone: THAI_TIME_ZONE,
      year: "numeric",
      month: "short",
      day: "2-digit",
    },
  ).format(date)
}

export function formatThaiTime(
  value: string | number | Date,
): string {
  const date = parseDate(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      timeZone: THAI_TIME_ZONE,
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      hour12: false,
    },
  ).format(date)
}

export function formatThaiShortDate(
  value: string | number | Date,
): string {
  const date =
    value instanceof Date
      ? value
      : new Date(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      timeZone: "Asia/Bangkok",
      day: "2-digit",
      month: "short",
    },
  ).format(date)
}