const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL ??
  "http://localhost:5000/api"

const TOKEN_KEY = "ai-cv-analyzer-token"

interface ApiErrorResponse {
  success?: boolean
  message?: string
  code?: string
}

export class ApiError extends Error {
  status: number
  code?: string

  constructor(
    message: string,
    status: number,
    code?: string,
  ) {
    super(message)

    this.name = "ApiError"
    this.status = status
    this.code = code
  }
}

export function getAccessToken():
  string | null {
  return localStorage.getItem(TOKEN_KEY)
}

export function setAccessToken(
  token: string,
): void {
  localStorage.setItem(
    TOKEN_KEY,
    token,
  )
}

export function clearAccessToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = getAccessToken()

  const headers = new Headers(
    options.headers,
  )

  if (
    options.body &&
    !(options.body instanceof FormData)
  ) {
    headers.set(
      "Content-Type",
      "application/json",
    )
  }

  if (token) {
    headers.set(
      "Authorization",
      `Bearer ${token}`,
    )
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      ...options,
      headers,
    },
  )

  const body = await response
    .json()
    .catch(() => null)

  if (!response.ok) {
    const errorBody =
      body as ApiErrorResponse | null

    throw new ApiError(
      errorBody?.message ??
        "เกิดข้อผิดพลาดในการเชื่อมต่อ",
      response.status,
      errorBody?.code,
    )
  }

  return body as T
}