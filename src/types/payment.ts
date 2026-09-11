export type PaymentStatus = 'PENDING' | 'PROCESSING' | 'PAID' | 'CANCELLED'
export type PaymentAttemptStatus = 'CREATED' | 'PROCESSING' | 'APPROVED' | 'REJECTED' | 'ERROR' | 'CANCELLED' | 'EXPIRED'
export type PaymentProvider = 'DEMO' | 'MERCADO_PAGO'
export type PaymentMethod = 'DEMO' | 'PIX' | 'CARD'

export interface PaymentAttempt {
  id: string
  sequence: number
  status: PaymentAttemptStatus
  provider: PaymentProvider
  method: PaymentMethod
  expiresAt: string | null
  completedAt: string | null
}

export interface Payment {
  id: string
  orderId: string
  status: PaymentStatus
  amount: string
  currency: 'BRL'
  paidAt: string | null
  cancelledAt: string | null
  latestAttempt: PaymentAttempt | null
}

export interface CreatePaymentAttemptInput {
  orderId: string
  idempotencyKey: string
}

export interface FrozenPaymentAttempt extends CreatePaymentAttemptInput {
  body: Readonly<Record<string, never>>
}
