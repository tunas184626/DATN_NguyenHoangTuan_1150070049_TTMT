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

export async function apiGet<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS, signal?: AbortSignal): Promise<T> {
  return apiRequest<T>(path, { method: 'GET', signal }, timeoutMs)
}

export async function apiRequest<T>(
  path: string,
  options: RequestInit,
  timeoutMs = 5000,
): Promise<T> {
  const controller = new AbortController()
  const externalSignal = options.signal
  const abortFromCaller = () => controller.abort()
  if (externalSignal?.aborted) controller.abort()
  else externalSignal?.addEventListener('abort', abortFromCaller, { once: true })
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const headers = new Headers(options.headers)
    headers.set('Accept', 'application/json')
    if (options.body && !(options.body instanceof FormData)) headers.set('Content-Type', 'application/json')
    const accessToken = await getAccessToken()
    if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

    const response = await fetch(apiUrl(path), {
      ...options,
      headers,
      signal: controller.signal,
    })

    if (!response.ok) {
      const errorBody = await response.json().catch(() => null) as { error?: { message?: string } } | null
      throw new ApiRequestError(
        errorBody?.error?.message ||
          (response.status === 503 ? 'Dữ liệu trực tuyến chưa sẵn sàng' : `Yêu cầu thất bại (${response.status})`),
        response.status,
      )
    }

    if (response.status === 204) return undefined as T
    return (await response.json()) as T
  } catch (error) {
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiRequestError('Kết nối dữ liệu quá thời gian')
    }
    throw error
  } finally {
    window.clearTimeout(timeout)
    externalSignal?.removeEventListener('abort', abortFromCaller)
  }
}
import { getAccessToken } from './supabaseClient'
