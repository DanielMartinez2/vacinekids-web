import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/httpClient'
import { customerProfileFixture, dependentFixture } from '../test/fixtures'
import { server } from '../test/server'
import { customerService } from './customerService'

const envelope = <T,>(data: T) => HttpResponse.json({ data, error: null })
const failure = (status: number, code = 'TEST_ERROR') => HttpResponse.json(
  { data: null, error: { code, message: 'private backend details' } }, { status },
)

describe('customerService', () => {
  it('aceita profile completo e ausência representada por null', async () => {
    server.use(http.get(API_BASE_URL + '/profile', () => envelope(customerProfileFixture)))
    await expect(customerService.getProfile()).resolves.toEqual(customerProfileFixture)
    server.use(http.get(API_BASE_URL + '/profile', () => envelope(null)))
    await expect(customerService.getProfile()).resolves.toBeNull()
  })

  it('envia PUT profile com credentials, JSON, CSRF e payload público estrito', async () => {
    let captured: Request | undefined
    let payload: unknown
    server.use(http.put(API_BASE_URL + '/profile', async ({ request }) => {
      captured = request
      payload = await request.json()
      return envelope(customerProfileFixture)
    }))
    await expect(customerService.putProfile({ name: 'Marina Exemplo', phone: '+5511999990001' }))
      .resolves.toEqual(customerProfileFixture)
    expect(captured?.method).toBe('PUT')
    expect(captured?.credentials).toBe('include')
    expect(captured?.headers.get('X-VacineKids-CSRF')).toBe('1')
    expect(captured?.headers.get('Content-Type')).toBe('application/json')
    expect(payload).toEqual({ name: 'Marina Exemplo', phone: '+5511999990001' })
  })

  it('lista dependentes com paginação e cookie sem CSRF em GET', async () => {
    server.use(http.get(API_BASE_URL + '/dependents', ({ request }) => {
      const url = new URL(request.url)
      expect(url.searchParams.get('page')).toBe('2')
      expect(url.searchParams.get('pageSize')).toBe('20')
      expect(request.credentials).toBe('include')
      expect(request.headers.has('X-VacineKids-CSRF')).toBe(false)
      return HttpResponse.json({ data: [dependentFixture], meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 }, error: null })
    }))
    await expect(customerService.listDependents({ page: 2, pageSize: 20 })).resolves.toEqual({
      items: [dependentFixture], meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
    })
  })

  it('cria, consulta e atualiza dependente com contratos corretos', async () => {
    const requests: Array<{ method: string; body?: unknown }> = []
    server.use(
      http.post(API_BASE_URL + '/dependents', async ({ request }) => {
        expect(request.credentials).toBe('include')
        expect(request.headers.get('X-VacineKids-CSRF')).toBe('1')
        requests.push({ method: request.method, body: await request.json() })
        return envelope(dependentFixture)
      }),
      http.get(API_BASE_URL + '/dependents/:id', ({ request, params }) => {
        expect(params.id).toBe(dependentFixture.id)
        expect(request.credentials).toBe('include')
        return envelope(dependentFixture)
      }),
      http.patch(API_BASE_URL + '/dependents/:id', async ({ request }) => {
        expect(request.credentials).toBe('include')
        expect(request.headers.get('X-VacineKids-CSRF')).toBe('1')
        requests.push({ method: request.method, body: await request.json() })
        return envelope({ ...dependentFixture, name: 'Lia Atualizada' })
      }),
    )
    await expect(customerService.createDependent({ name: dependentFixture.name, birthDate: dependentFixture.birthDate })).resolves.toEqual(dependentFixture)
    await expect(customerService.getDependent(dependentFixture.id)).resolves.toEqual(dependentFixture)
    await expect(customerService.updateDependent(dependentFixture.id, { name: 'Lia Atualizada' }))
      .resolves.toEqual({ ...dependentFixture, name: 'Lia Atualizada' })
    expect(requests).toEqual([
      { method: 'POST', body: { name: dependentFixture.name, birthDate: dependentFixture.birthDate } },
      { method: 'PATCH', body: { name: 'Lia Atualizada' } },
    ])
  })

  it('aceita DELETE 204 e envia proteção de escrita', async () => {
    server.use(http.delete(API_BASE_URL + '/dependents/:id', ({ request }) => {
      expect(request.credentials).toBe('include')
      expect(request.headers.get('X-VacineKids-CSRF')).toBe('1')
      return new HttpResponse(null, { status: 204 })
    }))
    await expect(customerService.deleteDependent(dependentFixture.id)).resolves.toBeUndefined()
  })

  it.each([401, 403, 409, 422, 503])('preserva status HTTP %s sem expor mensagem interna', async (status) => {
    server.use(http.get(API_BASE_URL + '/profile', () => failure(status, status === 409 ? 'PROFILE_REQUIRED' : 'PRIVATE')))
    await expect(customerService.getProfile()).rejects.toMatchObject({ kind: 'http', status })
    await expect(customerService.getProfile()).rejects.not.toThrow('private backend details')
  })

  it('propaga erro de rede seguro', async () => {
    server.use(http.get(API_BASE_URL + '/profile', () => HttpResponse.error()))
    await expect(customerService.getProfile()).rejects.toMatchObject({ kind: 'network' })
  })

  it('propaga timeout seguro do cliente HTTP', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    try {
      const request = customerService.getProfile()
      const rejected = expect(request).rejects.toMatchObject({ kind: 'timeout' })
      await vi.advanceTimersByTimeAsync(8_001)
      await rejected
    } finally {
      fetchSpy.mockRestore()
      vi.useRealTimers()
    }
  })

  it.each([
    { data: {}, error: null },
    { data: [{ id: 'missing-fields' }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, error: null },
    { data: [dependentFixture], error: null },
    { data: [dependentFixture], meta: { page: 0, pageSize: 20, total: 1, totalPages: 1 }, error: null },
  ])('rejeita resposta malformada de dependents', async (body) => {
    server.use(http.get(API_BASE_URL + '/dependents', () => HttpResponse.json(body)))
    await expect(customerService.listDependents()).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
