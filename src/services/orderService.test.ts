import { http, HttpResponse } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/httpClient'
import { checkoutPreviewFixture, orderDetailsFixture, orderSummaryFixture, vaccineFixture } from '../test/fixtures'
import { server } from '../test/server'
import type { CheckoutIntentItem } from '../types/order'
import { orderService } from './orderService'

const intent: CheckoutIntentItem[] = [{ productType: 'VACCINE', productId: vaccineFixture.id, recipients: [{ type: 'CUSTOMER' }] }]
const envelope = <T,>(data: T, status = 200) => HttpResponse.json({ data, error: null }, { status })
const failure = (status: number, code = 'TEST_ERROR') => HttpResponse.json({ data: null, error: { code, message: 'private stack and SQL' } }, { status })

describe('orderService', () => {
  it('preview envia somente intenção pública com cookie e CSRF', async () => {
    let captured: Request | undefined
    let body: unknown
    server.use(http.post(API_BASE_URL + '/checkout/preview', async ({ request }) => {
      captured = request
      body = await request.json()
      return envelope(checkoutPreviewFixture)
    }))
    await expect(orderService.previewCheckout(intent)).resolves.toEqual(checkoutPreviewFixture)
    expect(captured?.credentials).toBe('include')
    expect(captured?.headers.get('X-VacineKids-CSRF')).toBe('1')
    expect(captured?.headers.has('Idempotency-Key')).toBe(false)
    expect(body).toEqual({ items: intent })
    expect(JSON.stringify(body)).not.toMatch(/price|quantity|total|name|currency|manufacturer/i)
  })

  it.each([201, 200])('create aceita sucesso %s e isola Idempotency-Key do body', async (status) => {
    const key = '70000000-0000-4000-8000-000000000001'
    let captured: Request | undefined
    let body: unknown
    server.use(http.post(API_BASE_URL + '/orders', async ({ request }) => {
      captured = request
      body = await request.json()
      return envelope(orderDetailsFixture, status)
    }))
    await expect(orderService.createOrder({
      items: intent, checkoutFingerprint: 'a'.repeat(64), checkoutFingerprintVersion: 1, idempotencyKey: key,
    })).resolves.toEqual(orderDetailsFixture)
    expect(captured?.credentials).toBe('include')
    expect(captured?.headers.get('X-VacineKids-CSRF')).toBe('1')
    expect(captured?.headers.get('Idempotency-Key')).toBe(key)
    expect(body).toEqual({ items: intent, checkoutFingerprint: 'a'.repeat(64), checkoutFingerprintVersion: 1 })
    expect(JSON.stringify(body)).not.toContain('idempotencyKey')
  })

  it('lista, consulta e cancela com os contratos HTTP exatos', async () => {
    const captured: Request[] = []
    let cancelBody: unknown
    server.use(
      http.get(API_BASE_URL + '/orders', ({ request }) => {
        captured.push(request)
        const url = new URL(request.url)
        expect(url.searchParams.get('page')).toBe('2')
        expect(url.searchParams.get('pageSize')).toBe('20')
        return HttpResponse.json({ data: [orderSummaryFixture], meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 }, error: null })
      }),
      http.get(API_BASE_URL + '/orders/:id', ({ request }) => { captured.push(request); return envelope(orderDetailsFixture) }),
      http.post(API_BASE_URL + '/orders/:id/cancel', async ({ request }) => {
        captured.push(request); cancelBody = await request.json()
        return envelope({ ...orderDetailsFixture, status: 'CANCELLED', cancelledAt: '2026-09-09T13:00:00.000Z' })
      }),
    )
    await expect(orderService.listOrders({ page: 2, pageSize: 20 })).resolves.toEqual({
      items: [orderSummaryFixture], meta: { page: 2, pageSize: 20, total: 21, totalPages: 2 },
    })
    await expect(orderService.getOrder(orderDetailsFixture.id)).resolves.toEqual(orderDetailsFixture)
    await expect(orderService.cancelOrder(orderDetailsFixture.id)).resolves.toMatchObject({ status: 'CANCELLED' })
    expect(captured.every((request) => request.credentials === 'include')).toBe(true)
    expect(captured[0].headers.has('X-VacineKids-CSRF')).toBe(false)
    expect(captured[1].headers.has('X-VacineKids-CSRF')).toBe(false)
    expect(captured[2].headers.get('X-VacineKids-CSRF')).toBe('1')
    expect(captured[2].headers.has('Idempotency-Key')).toBe(false)
    expect(cancelBody).toEqual({})
  })

  it('aceita PAID em resumo e detalhe sem cancelledAt', async () => {
    server.use(
      http.get(API_BASE_URL + '/orders', () => HttpResponse.json({ data: [{ ...orderSummaryFixture, status: 'PAID' }], meta: { page: 1, pageSize: 20, total: 1, totalPages: 1 }, error: null })),
      http.get(API_BASE_URL + '/orders/:id', () => envelope({ ...orderDetailsFixture, status: 'PAID' })),
    )
    await expect(orderService.listOrders()).resolves.toMatchObject({ items: [{ status: 'PAID' }] })
    await expect(orderService.getOrder(orderDetailsFixture.id)).resolves.toMatchObject({ status: 'PAID', cancelledAt: null })
  })

  it.each([
    [401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'ORDER_NOT_FOUND'], [409, 'CHECKOUT_CHANGED'],
    [422, 'VALIDATION_ERROR'], [429, 'RATE_LIMITED'], [503, 'DEPENDENCY_UNAVAILABLE'],
  ])('preserva status/code HTTP %s sem expor mensagem privada', async (status, code) => {
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => failure(status as number, String(code))))
    await expect(orderService.previewCheckout(intent)).rejects.toMatchObject({ kind: 'http', status, code })
    await expect(orderService.previewCheckout(intent)).rejects.not.toThrow('private stack')
  })

  it('trata erro de rede e timeout com mensagens seguras', async () => {
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => HttpResponse.error()))
    await expect(orderService.previewCheckout(intent)).rejects.toMatchObject({ kind: 'network' })

    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    try {
      const pending = orderService.previewCheckout(intent)
      const rejected = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
      await vi.advanceTimersByTimeAsync(15_001)
      await rejected
    } finally { fetchSpy.mockRestore(); vi.useRealTimers() }
  })

  it.each([
    {},
    { ...checkoutPreviewFixture, checkoutFingerprint: 'INVALID' },
    { ...checkoutPreviewFixture, totalAmount: 12 },
    { ...checkoutPreviewFixture, items: [{ ...checkoutPreviewFixture.items[0], quantity: 3 }] },
    { ...checkoutPreviewFixture, items: [{ ...checkoutPreviewFixture.items[0], components: [{}] }] },
  ])('rejeita preview malformado em runtime', async (data) => {
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => envelope(data)))
    await expect(orderService.previewCheckout(intent)).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it.each([
    { ...orderDetailsFixture, number: '1' },
    { ...orderDetailsFixture, status: 'UNKNOWN' },
    { ...orderDetailsFixture, cancelledAt: '2026-01-01T00:00:00Z' },
    { ...orderDetailsFixture, customer: {} },
  ])('rejeita Order malformado em runtime', async (data) => {
    server.use(http.get(API_BASE_URL + '/orders/:id', () => envelope(data)))
    await expect(orderService.getOrder(orderDetailsFixture.id)).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
