const DEFAULT_TIMEOUT_MS = 3500

function apiUrl(path: string): string {
  const baseUrl = String(import.meta.env.VITE_API_URL ?? '/api').replace(/\/$/, '')
  return `${baseUrl}${path.startsWith('/') ? path : `/${path}`}`
}

export class ApiRequestError extends Error {
  readonly status?: number

  constructor(
    message: string,
    status?: number,
  ) {
    super(message)
    this.name = 'ApiRequestError'
    this.status = status
  }
}

export async function apiGet<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<T> {
  return apiRequest<T>(path, { method: 'GET' }, timeoutMs)
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  timeoutMs = 5000,
): Promise<T> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(apiUrl(path), {
      ...options,
      headers: {
        Accept: 'application/json',
        ...(options.body ? { 'Content-Type': 'application/json' } : {}),
        ...options.headers,
      },
      signal: controller.signal,
    })

    if (!response.ok) {
      throw new ApiRequestError(
        response.status === 503 ? 'Dữ liệu trực tuyến chưa sẵn sàng' : `Yêu cầu thất bại (${response.status})`,
        response.status,
      )
    }

    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('Kết nối dữ liệu quá thời gian')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
  }
}
