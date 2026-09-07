import { ApiClientError, apiRequest } from '../api/httpClient'
import type { AuthUser } from '../types/auth'

const invalidResponse = () => new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response')
function publicUser(value: unknown): AuthUser {
  if (!value || typeof value !== 'object') throw invalidResponse()
  const user = value as Record<string, unknown>
  if (typeof user.id !== 'string' || !user.id || typeof user.email !== 'string' || !user.email
    || !['CUSTOMER', 'ADMIN'].includes(String(user.role))
    || !['ACTIVE', 'DISABLED'].includes(String(user.status))) throw invalidResponse()
  return { id: user.id, email: user.email, role: user.role as AuthUser['role'], status: user.status as AuthUser['status'] }
}
export const authService = {
  async register(email: string, password: string): Promise<void> {
    const response = await apiRequest<{ message: string }>('/auth/register', {
      method: 'POST', authenticated: true, body: { email: email.trim(), password },
    })
    if (!response || typeof response.data?.message !== 'string') throw invalidResponse()
  },
  async login(email: string, password: string): Promise<AuthUser> {
    const response = await apiRequest<unknown>('/auth/login', {
      method: 'POST', authenticated: true, body: { email: email.trim(), password },
    })
    return publicUser(response?.data)
  },
  async logout(): Promise<void> {
    const response = await apiRequest<never>('/auth/logout', { method: 'POST', authenticated: true, body: {} })
    if (response !== undefined) throw invalidResponse()
  },
  async me(): Promise<AuthUser> {
    const response = await apiRequest<unknown>('/auth/me', { authenticated: true })
    return publicUser(response?.data)
  },
}
export type AuthService = typeof authService
