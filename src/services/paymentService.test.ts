import { http, HttpResponse, delay } from 'msw'
import { describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../api/httpClient'
import {
  paymentCancelledFixture,
  paymentPaidFixture,
  paymentPendingErrorFixture,
  paymentPendingRejectedFixture,
  paymentProcessingFixture,
} from '../test/fixtures'
import { server } from '../test/server'
import { paymentService } from './paymentService'

const envelope = <T,>(data: T, status = 200) => HttpResponse.json({ data, error: null }, { status })
const failure = (status: number, code: string) => HttpResponse.json({ data: null, error: { code, message: 'private provider detail and SQL' } }, { status })

describe('paymentService', () => {
  it.each([
    ['null', null],
    ['PENDING', paymentPendingRejectedFixture],
    ['PROCESSING', paymentProcessingFixture],
    ['PAID', paymentPaidFixture],
    ['CANCELLED', paymentCancelledFixture],
  ])('valida GET Payment %s', async (_name, value) => {
    server.use(http.get(API_BASE_URL + '/orders/:id/payment', () => envelope(value)))
    await expect(paymentService.getPayment(paymentPaidFixture.orderId)).resolves.toEqual(value)
  })

  it('GET autenticado não envia CSRF nem Idempotency-Key', async () => {
    let captured: Request | undefined
    server.use(http.get(API_BASE_URL + '/orders/:id/payment', ({ request }) => { captured = request; return envelope(null) }))
    await paymentService.getPayment(paymentPaidFixture.orderId)
    expect(captured?.credentials).toBe('include')
    expect(captured?.headers.has('X-VacineKids-CSRF')).toBe(false)
    expect(captured?.headers.has('Idempotency-Key')).toBe(false)
  })

  it.each([[401, 'UNAUTHENTICATED'], [403, 'FORBIDDEN'], [404, 'ORDER_NOT_FOUND'], [429, 'RATE_LIMITED'], [503, 'DEPENDENCY_UNAVAILABLE']])(
    'GET preserva HTTP %s/%s com mensagem pública', async (status, code) => {
      server.use(http.get(API_BASE_URL + '/orders/:id/payment', () => failure(status as number, String(code))))
      await expect(paymentService.getPayment(paymentPaidFixture.orderId)).rejects.toMatchObject({ kind: 'http', status, code })
      await expect(paymentService.getPayment(paymentPaidFixture.orderId)).rejects.not.toThrow('private provider detail')
    },
  )

  it.each([201, 200])('POST aceita %s, envia somente {} e isola a key UUID no header', async (status) => {
    const key = '90000000-0000-4000-8000-000000000001'
    let captured: Request | undefined
    let body: unknown
    server.use(http.post(API_BASE_URL + '/orders/:id/payment-attempts', async ({ request }) => {
      captured = request
      body = await request.json()
      return envelope(paymentPaidFixture, status)
    }))
    await expect(paymentService.createPaymentAttempt({ orderId: paymentPaidFixture.orderId, idempotencyKey: key })).resolves.toEqual(paymentPaidFixture)
    expect(captured?.credentials).toBe('include')
    expect(captured?.headers.get('X-VacineKids-CSRF')).toBe('1')
    expect(captured?.headers.get('Idempotency-Key')).toBe(key)
    expect(body).toEqual({})
    expect(JSON.stringify(body)).not.toMatch(/amount|currency|status|provider|method|result|paymentId|providerPaymentId/i)
  })

  it.each([
    [409, 'PAYMENT_ALREADY_PROCESSING'],
    [409, 'PAYMENT_ALREADY_PAID'],
    [409, 'PAYMENT_IDEMPOTENCY_KEY_REUSED'],
    [409, 'ORDER_NOT_PAYABLE'],
    [409, 'PAYMENT_STATE_CONFLICT'],
    [429, 'RATE_LIMITED'],
    [502, 'PAYMENT_PROVIDER_ERROR'],
    [503, 'PAYMENT_PROVIDER_UNAVAILABLE'],
    [504, 'PAYMENT_PROVIDER_TIMEOUT'],
  ])('preserva HTTP %s/%s sem expor mensagem interna', async (status, code) => {
    server.use(http.post(API_BASE_URL + '/orders/:id/payment-attempts', () => failure(status as number, String(code))))
    await expect(paymentService.createPaymentAttempt({ orderId: paymentPaidFixture.orderId, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ kind: 'http', status, code })
    await expect(paymentService.createPaymentAttempt({ orderId: paymentPaidFixture.orderId, idempotencyKey: crypto.randomUUID() })).rejects.not.toThrow('private provider detail')
  })

  it('trata network e timeouts isolados de GET/POST', async () => {
    server.use(http.get(API_BASE_URL + '/orders/:id/payment', () => HttpResponse.error()))
    await expect(paymentService.getPayment(paymentPaidFixture.orderId)).rejects.toMatchObject({ kind: 'network' })

    vi.useFakeTimers()
    server.use(http.post(API_BASE_URL + '/orders/:id/payment-attempts', async () => { await delay('infinite'); return envelope(paymentPaidFixture, 201) }))
    try {
      const pending = paymentService.createPaymentAttempt({ orderId: paymentPaidFixture.orderId, idempotencyKey: crypto.randomUUID() })
      const rejected = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
      await vi.advanceTimersByTimeAsync(15_001)
      await rejected
    } finally { vi.useRealTimers() }
  })

  it('GET usa timeout global sem ampliar o cliente e POST rejeita DTO inválido', async () => {
    vi.useFakeTimers()
    const fetchSpy = vi.spyOn(globalThis, 'fetch').mockImplementation((_input, init) => new Promise((_resolve, reject) => {
      init?.signal?.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')))
    }))
    try {
      const pending = paymentService.getPayment(paymentPaidFixture.orderId)
      const rejected = expect(pending).rejects.toMatchObject({ kind: 'timeout' })
      await vi.advanceTimersByTimeAsync(8_001)
      await rejected
    } finally { fetchSpy.mockRestore(); vi.useRealTimers() }

    server.use(http.post(API_BASE_URL + '/orders/:id/payment-attempts', () => envelope({ ...paymentPaidFixture, latestAttempt: { status: 'APPROVED' } }, 201)))
    await expect(paymentService.createPaymentAttempt({ orderId: paymentPaidFixture.orderId, idempotencyKey: crypto.randomUUID() })).rejects.toMatchObject({ kind: 'invalid-response' })
  })

  it.each([
    {},
    { ...paymentPaidFixture, id: 'invalid' },
    { ...paymentPaidFixture, status: 'UNKNOWN' },
    { ...paymentPaidFixture, amount: 918.8 },
    { ...paymentPaidFixture, currency: 'USD' },
    { ...paymentPaidFixture, paidAt: 'invalid' },
    { ...paymentPaidFixture, paidAt: null },
    { ...paymentProcessingFixture, paidAt: paymentPaidFixture.paidAt },
    { ...paymentPaidFixture, latestAttempt: { ...paymentPaidFixture.latestAttempt, sequence: 0 } },
    { ...paymentPendingErrorFixture, latestAttempt: { ...paymentPendingErrorFixture.latestAttempt, provider: 'PRIVATE' } },
  ])('rejeita Payment malformado em runtime', async (data) => {
    server.use(http.get(API_BASE_URL + '/orders/:id/payment', () => envelope(data)))
    await expect(paymentService.getPayment(paymentPaidFixture.orderId)).rejects.toMatchObject({ kind: 'invalid-response' })
  })
})
