import type { ApiResponse } from '../types/api'

const DEFAULT_TIMEOUT_MS = 8_000
const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')
export const API_BASE_URL = configuredApiUrl.endsWith('/api/v1')
  ? configuredApiUrl
  : `${configuredApiUrl}/api/v1`

export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response'

export class ApiClientError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string

  constructor(
    message: string,
    kind: ApiErrorKind,
    status?: number,
    code?: string,
  ) {
    super(message)
    this.name = 'ApiClientError'
    this.kind = kind
    this.status = status
    this.code = code
  }
}

function friendlyHttpMessage(status: number, fallback?: string) {
  if (status === 404) return 'O item solicitado não foi encontrado.'
  if (status >= 500) return 'A API encontrou um problema. Tente novamente em instantes.'
  return fallback || 'Não foi possível concluir a solicitação.'
}

export async function apiGet<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ApiResponse<T>> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)

  try {
    const response = await fetch(`${API_BASE_URL}${path}`, {
      headers: { Accept: 'application/json' },
      signal: controller.signal,
    })

    let body: ApiResponse<T>
    try {
      body = (await response.json()) as ApiResponse<T>
    } catch {
      throw new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response', response.status)
    }

    if (!response.ok || body.error) {
      throw new ApiClientError(
        friendlyHttpMessage(response.status, body.error?.message),
        'http',
        response.status,
        body.error?.code,
      )
    }

    return body
  } catch (error) {
    if (error instanceof ApiClientError) throw error
    if (error instanceof DOMException && error.name === 'AbortError') {
      throw new ApiClientError('A API demorou demais para responder.', 'timeout')
    }
    throw new ApiClientError('Não foi possível conectar à API. Verifique se o backend está em execução.', 'network')
  } finally {
    window.clearTimeout(timeout)
  }
}
