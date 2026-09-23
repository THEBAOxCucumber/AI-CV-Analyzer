const THAI_TIME_ZONE = "Asia/Bangkok"

function parseDate(
  value: string | number | Date,
): Date {
  if (value instanceof Date) {
    return value
  }

  return new Date(value)
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
  const date = parseDate(value)

  if (Number.isNaN(date.getTime())) {
    return "-"
  }

  return new Intl.DateTimeFormat(
    "th-TH",
    {
      timeZone: THAI_TIME_ZONE,
      day: "2-digit",
      month: "short",
    },
  ).format(date)
}