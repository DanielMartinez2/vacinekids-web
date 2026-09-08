import type { ApiResponse } from '../types/api'

const DEFAULT_TIMEOUT_MS = 8_000
const configuredApiUrl = (import.meta.env.VITE_API_URL || 'http://localhost:3001').replace(/\/$/, '')
export const API_BASE_URL = configuredApiUrl.endsWith('/api/v1') ? configuredApiUrl : `${configuredApiUrl}/api/v1`
export type ApiErrorKind = 'http' | 'network' | 'timeout' | 'invalid-response'
export class ApiClientError extends Error {
  readonly kind: ApiErrorKind
  readonly status?: number
  readonly code?: string
  constructor(message: string, kind: ApiErrorKind, status?: number, code?: string) {
    super(message)
    this.name = 'ApiClientError'
    this.kind = kind
    this.status = status
    this.code = code
  }
}
function friendlyHttpMessage(status: number) {
  if (status === 401) return 'Autenticação necessária.'
  if (status === 403) return 'Acesso não autorizado.'
  if (status === 404) return 'O item solicitado não foi encontrado.'
  if (status === 422) return 'Verifique os dados informados e tente novamente.'
  if (status === 429) return 'Muitas tentativas. Aguarde alguns instantes antes de tentar novamente.'
  if (status >= 500) return 'A API encontrou um problema. Tente novamente em instantes.'
  return 'Não foi possível concluir a solicitação.'
}
interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  body?: unknown
  authenticated?: boolean
  timeoutMs?: number
}
export async function apiRequest<T>(path: string, {
  method = 'GET', body, authenticated = false, timeoutMs = DEFAULT_TIMEOUT_MS,
}: RequestOptions = {}): Promise<ApiResponse<T> | undefined> {
  const controller = new AbortController()
  const timeout = window.setTimeout(() => controller.abort(), timeoutMs)
  try {
    const writing = method !== 'GET'
    const response = await fetch(`${API_BASE_URL}${path}`, {
      method,
      headers: {
        Accept: 'application/json',
        ...(writing ? { 'Content-Type': 'application/json', 'X-VacineKids-CSRF': '1' } : {}),
      },
      credentials: authenticated ? 'include' : 'omit',
      ...(writing && body !== undefined ? { body: JSON.stringify(body) } : {}),
      signal: controller.signal,
    })
    // A 204 intentionally has no JSON body (notably logout).
    if (response.status === 204) return undefined
    let value: unknown
    try { value = await response.json() } catch {
      throw new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response', response.status)
    }
    if (!value || typeof value !== 'object' || !('data' in value) || !('error' in value)) {
      throw new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response', response.status)
    }
    const result = value as ApiResponse<T>
    // Never display backend messages, SQL, stack traces or reflected form values.
    if (!response.ok || result.error) throw new ApiClientError(
      friendlyHttpMessage(response.status), 'http', response.status,
      typeof result.error?.code === 'string' ? result.error.code : undefined,
    )
    return result
  } catch (error) {
    if (error instanceof ApiClientError) throw error
    if (controller.signal.aborted) throw new ApiClientError('A API demorou demais para responder.', 'timeout')
    throw new ApiClientError('Não foi possível conectar à API. Verifique se o backend está em execução.', 'network')
  } finally { window.clearTimeout(timeout) }
}
// Existing catalog callers retain their original signature and JSON contract.
export async function apiGet<T>(path: string, timeoutMs = DEFAULT_TIMEOUT_MS): Promise<ApiResponse<T>> {
  const result = await apiRequest<T>(path, { timeoutMs })
  if (!result) throw new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response', 204)
  return result
}
