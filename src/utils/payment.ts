import { ApiClientError } from '../api/httpClient'
import type { Payment, PaymentAttemptStatus } from '../types/payment'

const retryableAttemptStatuses: readonly PaymentAttemptStatus[] = ['REJECTED', 'ERROR', 'CANCELLED', 'EXPIRED']

export const paymentIsActive = (payment: Payment | null) => payment?.status === 'PROCESSING'
  || payment?.latestAttempt?.status === 'CREATED'
  || payment?.latestAttempt?.status === 'PROCESSING'

export const paymentAllowsNewAttempt = (payment: Payment | null) => payment === null
  || (payment.status === 'PENDING' && (!payment.latestAttempt || retryableAttemptStatuses.includes(payment.latestAttempt.status)))

export function paymentAttemptMessage(payment: Payment | null) {
  if (!payment) return 'Este pedido ainda não foi pago.'
  if (payment.status === 'PAID') return 'Pagamento aprovado.'
  if (payment.status === 'CANCELLED') return 'Pagamento cancelado.'
  if (payment.latestAttempt?.status === 'CREATED') return 'Preparando o pagamento.'
  if (payment.status === 'PROCESSING' || payment.latestAttempt?.status === 'PROCESSING') return 'Pagamento em processamento.'
  if (payment.latestAttempt?.status === 'REJECTED') return 'O pagamento não foi aprovado. Você pode tentar novamente.'
  if (payment.latestAttempt?.status === 'ERROR') return 'Não foi possível processar o pagamento. Você pode tentar novamente.'
  if (payment.latestAttempt?.status === 'EXPIRED') return 'A tentativa de pagamento expirou. Você pode tentar novamente.'
  if (payment.latestAttempt?.status === 'CANCELLED') return 'A tentativa de pagamento foi cancelada. Você pode tentar novamente.'
  return 'Este pedido ainda não foi pago.'
}

export function paymentError(failure: unknown) {
  if (!(failure instanceof ApiClientError)) return 'Não foi possível concluir a operação de pagamento.'
  if (failure.kind === 'network' || failure.kind === 'timeout' || failure.status === 504) {
    return 'Não foi possível confirmar a resposta do servidor. A tentativa de pagamento pode ter sido processada.'
  }
  if (failure.status === 401) return 'Sua sessão não é mais válida. Estamos verificando seu acesso.'
  if (failure.status === 403) return 'Sua conta não tem permissão para acessar este pagamento.'
  if (failure.status === 404) return 'Pedido não encontrado.'
  if (failure.status === 429) return 'Muitas tentativas. Aguarde um pouco antes de tentar novamente.'
  if (failure.code === 'PAYMENT_PROVIDER_UNAVAILABLE' || failure.status === 503) return 'O pagamento demonstrativo está temporariamente indisponível.'
  if (failure.code === 'PAYMENT_IDEMPOTENCY_KEY_REUSED') return 'Não foi possível confirmar esta tentativa. Atualize o status antes de tentar novamente.'
  if (failure.code === 'PAYMENT_STATE_CONFLICT') return 'O estado do pagamento foi atualizado. Atualize os dados do pedido.'
  if (failure.code === 'ORDER_NOT_PAYABLE') return 'Este pedido não está mais disponível para pagamento.'
  if (failure.status === 502) return 'O provedor de pagamento apresentou uma falha. Atualize o status antes de tentar novamente.'
  return 'Não foi possível concluir a operação de pagamento.'
}
