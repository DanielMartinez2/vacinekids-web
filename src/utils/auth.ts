import { ApiClientError } from '../api/httpClient'
const destinations = new Set(['/', '/produtos', '/carrinho', '/minha-conta', '/admin'])
export function safeLoginDestination(state: unknown): string {
  if (state && typeof state === 'object' && 'from' in state
    && typeof state.from === 'string' && destinations.has(state.from)) return state.from
  return '/minha-conta'
}
export function validateAuthForm(email: string, password: string, confirmation?: string): string | null {
  const normalizedEmail = email.trim()
  if (normalizedEmail.length > 254 || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) return 'Informe um email válido.'
  const normalized = password.normalize('NFC')
  const length = [...normalized].length
  const minimum = confirmation === undefined ? 1 : 15
  if (length < minimum || length > 128) return confirmation === undefined
    ? 'Informe uma senha de até 128 caracteres.'
    : 'A senha deve ter de 15 a 128 caracteres.'
  if (confirmation !== undefined && normalized !== confirmation.normalize('NFC')) return 'As senhas precisam ser iguais.'
  return null
}
export function authFormError(failure: unknown, login: boolean): string {
  if (login && failure instanceof ApiClientError && failure.status === 401 && failure.kind === 'http') return 'Email ou senha inválidos.'
  if (failure instanceof ApiClientError) return failure.message
  return 'Não foi possível concluir a solicitação. Tente novamente.'
}
