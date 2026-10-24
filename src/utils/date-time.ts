const THAI_TIME_ZONE = "Asia/Bangkok"

type DateInput = string | number | Date

function parseDate(
  value: DateInput,
): Date {
  if (value instanceof Date) {
    return value
  }

  return new Date(value)
}

export function formatThaiDateTime(
  value: DateInput,
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
  value: DateInput,
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
  value: DateInput,
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
  value: DateInput,
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

/*
 * "YYYY-MM" ตามเวลาไทย
 * ใช้เทียบข้อมูลรายเดือน
 */
export function getThaiMonthKey(
  value: DateInput,
): string {
  const parts =
    new Intl.DateTimeFormat(
      "en-CA",
      {
        timeZone: THAI_TIME_ZONE,
        year: "numeric",
        month: "2-digit",
      },
    ).formatToParts(
      parseDate(value),
    )

  const year =
    parts.find((part) => part.type === "year")?.value

  const month =
    parts.find((part) => part.type === "month")?.value

  return `${year}-${month}`
}