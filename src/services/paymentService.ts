import { ApiClientError, apiRequest } from '../api/httpClient'
import type {
  CreatePaymentAttemptInput,
  Payment,
  PaymentAttempt,
  PaymentAttemptStatus,
  PaymentMethod,
  PaymentProvider,
  PaymentStatus,
} from '../types/payment'

const PAYMENT_TIMEOUT_MS = 15_000
const EMPTY_PAYMENT_BODY: Readonly<Record<string, never>> = Object.freeze({})
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MONEY = /^(0|[1-9]\d*)\.\d{2}$/
const ABSOLUTE_TIMESTAMP = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/

const invalidResponse = () => new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response')
const record = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse()
  return value as Record<string, unknown>
}
const uuid = (value: unknown) => {
  if (typeof value !== 'string' || !UUID.test(value)) throw invalidResponse()
  return value
}
const timestampOrNull = (value: unknown) => {
  if (value === null) return null
  if (typeof value !== 'string' || !ABSOLUTE_TIMESTAMP.test(value) || Number.isNaN(Date.parse(value))) throw invalidResponse()
  return value
}
const enumValue = <T extends string>(value: unknown, allowed: readonly T[]): T => {
  if (typeof value !== 'string' || !allowed.includes(value as T)) throw invalidResponse()
  return value as T
}

const paymentStatuses = ['PENDING', 'PROCESSING', 'PAID', 'CANCELLED'] as const satisfies readonly PaymentStatus[]
const attemptStatuses = ['CREATED', 'PROCESSING', 'APPROVED', 'REJECTED', 'ERROR', 'CANCELLED', 'EXPIRED'] as const satisfies readonly PaymentAttemptStatus[]
const providers = ['DEMO', 'MERCADO_PAGO'] as const satisfies readonly PaymentProvider[]
const methods = ['DEMO', 'PIX', 'CARD'] as const satisfies readonly PaymentMethod[]

function attemptFrom(value: unknown): PaymentAttempt {
  const attempt = record(value)
  if (typeof attempt.sequence !== 'number' || !Number.isInteger(attempt.sequence) || attempt.sequence < 1) throw invalidResponse()
  return {
    id: uuid(attempt.id),
    sequence: attempt.sequence,
    status: enumValue(attempt.status, attemptStatuses),
    provider: enumValue(attempt.provider, providers),
    method: enumValue(attempt.method, methods),
    expiresAt: timestampOrNull(attempt.expiresAt),
    completedAt: timestampOrNull(attempt.completedAt),
  }
}

function paymentFrom(value: unknown): Payment {
  const payment = record(value)
  if (typeof payment.amount !== 'string' || !MONEY.test(payment.amount) || payment.currency !== 'BRL') throw invalidResponse()
  const status = enumValue(payment.status, paymentStatuses)
  const paidAt = timestampOrNull(payment.paidAt)
  const cancelledAt = timestampOrNull(payment.cancelledAt)
  if ((status === 'PAID') !== (paidAt !== null) || (status === 'CANCELLED') !== (cancelledAt !== null)) throw invalidResponse()
  return {
    id: uuid(payment.id),
    orderId: uuid(payment.orderId),
    status,
    amount: payment.amount,
    currency: 'BRL',
    paidAt,
    cancelledAt,
    latestAttempt: payment.latestAttempt === null ? null : attemptFrom(payment.latestAttempt),
  }
}

function responseData(response: { data: unknown } | undefined) {
  if (!response) throw invalidResponse()
  return response.data
}

export const paymentService = {
  async getPayment(orderId: string): Promise<Payment | null> {
    const data = responseData(await apiRequest<unknown>(`/orders/${encodeURIComponent(orderId)}/payment`, {
      authenticated: true,
    }))
    return data === null ? null : paymentFrom(data)
  },

  async createPaymentAttempt({ orderId, idempotencyKey, body = EMPTY_PAYMENT_BODY }: CreatePaymentAttemptInput & { body?: Readonly<Record<string, never>> }): Promise<Payment> {
    return paymentFrom(responseData(await apiRequest<unknown>(`/orders/${encodeURIComponent(orderId)}/payment-attempts`, {
      method: 'POST',
      authenticated: true,
      body,
      idempotencyKey,
      timeoutMs: PAYMENT_TIMEOUT_MS,
    })))
  },
}

export type PaymentService = typeof paymentService
