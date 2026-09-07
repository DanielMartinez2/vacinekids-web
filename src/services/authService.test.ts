import { http, HttpResponse } from 'msw'
import { describe, expect, it } from 'vitest'
import { API_BASE_URL, apiGet, apiRequest } from '../api/httpClient'
import { server } from '../test/server'
import { authService } from './authService'

const user = { id: 'user-1', email: 'cliente@example.test', role: 'CUSTOMER', status: 'ACTIVE' }
describe('authService / HTTP client', () => {
  it.each(['register', 'login'] as const)('%s usa JSON, credentials e CSRF sem trim na senha', async (operation) => {
    let captured: Request | undefined
    let payload: unknown
    server.use(http.post(API_BASE_URL + '/auth/' + operation, async ({ request }) => {
      captured = request
      payload = await request.json()
      return HttpResponse.json({ data: operation === 'register' ? { message: 'Mensagem genérica' } : user, error: null })
    }))
    const result = await authService[operation](' cliente@example.test ', ' uma frase de senha ')
    expect(payload).toEqual({ email: 'cliente@example.test', password: ' uma frase de senha ' })
    expect(captured?.credentials).toBe('include')
    expect(captured?.headers.get('X-VacineKids-CSRF')).toBe('1')
    expect(captured?.headers.get('Content-Type')).toBe('application/json')
    expect(result).toEqual(operation === 'register' ? undefined : user)
  })
  it('logout aceita 204 vazio sem tentar parsear JSON', async () => {
    server.use(http.post(API_BASE_URL + '/auth/logout', ({ request }) => {
      expect(request.credentials).toBe('include')
      expect(request.headers.get('X-VacineKids-CSRF')).toBe('1')
      return new HttpResponse(null, { status: 204 })
    }))
    await expect(authService.logout()).resolves.toBeUndefined()
  })
  it('me envia cookies sem CSRF e retorna somente usuário público', async () => {
    server.use(http.get(API_BASE_URL + '/auth/me', ({ request }) => {
      expect(request.credentials).toBe('include')
      expect(request.headers.has('X-VacineKids-CSRF')).toBe(false)
      expect(request.headers.has('Content-Type')).toBe(false)
      return HttpResponse.json({ data: { ...user, unexpected: 'not part of the model' }, error: null })
    }))
    await expect(authService.me()).resolves.toEqual(user)
  })
  it.each(['PATCH', 'DELETE'] as const)('suporta %s com JSON e CSRF', async (method) => {
    server.use(http.all(API_BASE_URL + '/probe', async ({ request }) => {
      expect(request.method).toBe(method)
      expect(request.credentials).toBe('include')
      expect(request.headers.get('X-VacineKids-CSRF')).toBe('1')
      expect(await request.json()).toEqual({})
      return new HttpResponse(null, { status: 204 })
    }))
    await expect(apiRequest('/probe', { method, authenticated: true, body: {} })).resolves.toBeUndefined()
  })
  it('apiGet mantém assinatura e consulta pública sem cookies/CSRF', async () => {
    server.use(http.get(API_BASE_URL + '/probe', ({ request }) => {
      expect(request.credentials).toBe('omit')
      expect(request.headers.has('X-VacineKids-CSRF')).toBe(false)
      return HttpResponse.json({ data: [1], error: null })
    }))
    await expect(apiGet('/probe', 1000)).resolves.toEqual({ data: [1], error: null })
  })
  it.each([401, 403, 422, 429, 500, 503])('preserva HTTP %s sem detalhes internos', async (status) => {
    server.use(http.get(API_BASE_URL + '/auth/me', () => HttpResponse.json({ data: null, error: { code: 'PRIVATE', message: 'SQL private details' } }, { status })))
    await expect(authService.me()).rejects.toMatchObject({ kind: 'http', status })
    await expect(authService.me()).rejects.not.toThrow('SQL private details')
  })
  it('distingue indisponibilidade de rede', async () => {
    server.use(http.get(API_BASE_URL + '/auth/me', () => HttpResponse.error()))
    await expect(authService.me()).rejects.toMatchObject({ kind: 'network' })
  })
  it('distingue timeout e aborta fetch', async () => {
    server.use(http.get(API_BASE_URL + '/probe', async ({ request }) => {
      await new Promise<void>((resolve) => request.signal.addEventListener('abort', () => resolve(), { once: true }))
      return new HttpResponse(null, { status: 204 })
    }))
    await expect(apiGet('/probe', 20)).rejects.toMatchObject({ kind: 'timeout' })
  })
  it.each(['not json', 'null', '{}'])('rejeita resposta inválida: %s', async (value) => {
    server.use(http.get(API_BASE_URL + '/auth/me', () => new HttpResponse(value)))
    await expect(authService.me()).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('rejeita usuário público malformado', async () => {
    server.use(http.get(API_BASE_URL + '/auth/me', () => HttpResponse.json({ data: { email: user.email }, error: null })))
    await expect(authService.me()).rejects.toMatchObject({ kind: 'invalid-response' })
  })
  it('rejeita 204 em GET JSON e 200 inesperado em logout', async () => {
    server.use(http.get(API_BASE_URL + '/probe', () => new HttpResponse(null, { status: 204 })),
      http.post(API_BASE_URL + '/auth/logout', () => HttpResponse.json({ data: {}, error: null })))
    await expect(apiGet('/probe')).rejects.toMatchObject({ kind: 'invalid-response' })
    await expect(authService.logout()).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
