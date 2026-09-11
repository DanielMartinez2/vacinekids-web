import { describe, expect, it } from 'vitest'
import {
  paymentCancelledFixture,
  paymentPaidFixture,
  paymentPendingErrorFixture,
  paymentPendingExpiredFixture,
  paymentPendingRejectedFixture,
  paymentProcessingFixture,
} from '../test/fixtures'
import { paymentAllowsNewAttempt, paymentAttemptMessage, paymentIsActive } from './payment'

describe('payment helpers', () => {
  it.each([
    [null, 'Este pedido ainda não foi pago.'],
    [paymentPaidFixture, 'Pagamento aprovado.'],
    [paymentCancelledFixture, 'Pagamento cancelado.'],
    [paymentPendingRejectedFixture, 'O pagamento não foi aprovado. Você pode tentar novamente.'],
    [paymentPendingErrorFixture, 'Não foi possível processar o pagamento. Você pode tentar novamente.'],
    [paymentPendingExpiredFixture, 'A tentativa de pagamento expirou. Você pode tentar novamente.'],
    [paymentProcessingFixture, 'Pagamento em processamento.'],
  ])('mapeia estado para mensagem segura', (payment, expected) => expect(paymentAttemptMessage(payment)).toBe(expected))

  it('separa tentativa ativa de estados que permitem nova confirmação', () => {
    expect(paymentIsActive(paymentProcessingFixture)).toBe(true)
    expect(paymentAllowsNewAttempt(paymentProcessingFixture)).toBe(false)
    expect(paymentAllowsNewAttempt(paymentPaidFixture)).toBe(false)
    expect(paymentAllowsNewAttempt(paymentPendingRejectedFixture)).toBe(true)
    expect(paymentAllowsNewAttempt(null)).toBe(true)
  })
})
