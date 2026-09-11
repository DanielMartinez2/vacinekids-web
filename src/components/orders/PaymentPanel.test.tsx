import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../../api/httpClient'
import type { PaymentService } from '../../services/paymentService'
import {
  orderDetailsFixture,
  paymentCancelledFixture,
  paymentPaidFixture,
  paymentPendingErrorFixture,
  paymentPendingExpiredFixture,
  paymentPendingRejectedFixture,
  paymentProcessingFixture,
} from '../../test/fixtures'
import { renderWithProviders } from '../../test/render'
import type { OrderDetails } from '../../types/order'
import type { CreatePaymentAttemptInput, FrozenPaymentAttempt, Payment } from '../../types/payment'
import { PaymentPanel } from './PaymentPanel'

const paidOrder: OrderDetails = { ...orderDetailsFixture, status: 'PAID' }
const cancelledOrder: OrderDetails = { ...orderDetailsFixture, status: 'CANCELLED', cancelledAt: '2026-09-09T13:00:00.000Z' }

function serviceWith(
  getPayment: () => Promise<Payment | null>,
  createPaymentAttempt: (input: CreatePaymentAttemptInput) => Promise<Payment> = async () => paymentPaidFixture,
): PaymentService {
  return { getPayment: async () => getPayment(), createPaymentAttempt }
}

function renderPanel({
  payment = null,
  order = orderDetailsFixture,
  service,
  onOrderRefresh = vi.fn(async () => paidOrder),
  onPaymentState = vi.fn(),
}: {
  payment?: Payment | null
  order?: OrderDetails
  service?: PaymentService
  onOrderRefresh?: () => Promise<OrderDetails>
  onPaymentState?: (payment: Payment | null, resolved: boolean) => void
} = {}) {
  const resolvedService = service ?? serviceWith(async () => payment)
  const view = renderWithProviders(<PaymentPanel order={order} service={resolvedService} onOrderRefresh={onOrderRefresh} onPaymentState={onPaymentState} />)
  return { ...view, service: resolvedService, onOrderRefresh, onPaymentState }
}

async function confirmPayment(user = userEvent.setup()) {
  await user.click(await screen.findByRole('button', { name: /Pagar pedido|Tentar novo pagamento/ }))
  const dialog = screen.getByRole('dialog', { name: 'Confirmar pagamento demonstrativo?' })
  expect(screen.getByRole('button', { name: 'Confirmar pagamento' })).toHaveFocus()
  expect(dialog).toHaveTextContent('R$ 918,80')
  expect(dialog).toHaveTextContent('Nenhuma cobrança real será realizada')
  await user.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
}

describe('PaymentPanel', () => {
  it('mostra loading, Payment null, aviso DEMO e confirmação cancelável sem POST', async () => {
    const create = vi.fn(async (_input: CreatePaymentAttemptInput) => paymentPaidFixture)
    renderPanel({ service: serviceWith(async () => null, create) })
    expect(screen.getByRole('status')).toHaveTextContent('Carregando status do pagamento')
    expect(await screen.findByText('Este pedido ainda não foi pago.')).toBeInTheDocument()
    expect(screen.getByText('Pagamento demonstrativo — nenhuma cobrança real será realizada.')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Pagar pedido' }))
    expect(screen.getByRole('dialog')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Voltar' }))
    expect(create).not.toHaveBeenCalled()
  })

  it('gera crypto UUID, congela body vazio e bloqueia double-click em um POST', async () => {
    const key = '90000000-0000-4000-8000-000000000009'
    const randomUUID = vi.spyOn(crypto, 'randomUUID').mockReturnValue(key)
    let resolveAttempt!: (payment: Payment) => void
    const inputs: FrozenPaymentAttempt[] = []
    const create = vi.fn((input: CreatePaymentAttemptInput) => {
      inputs.push(input as FrozenPaymentAttempt)
      return new Promise<Payment>((resolve) => { resolveAttempt = resolve })
    })
    try {
      renderPanel({ service: serviceWith(async () => null, create) })
      const user = userEvent.setup()
      await user.click(await screen.findByRole('button', { name: 'Pagar pedido' }))
      await user.dblClick(screen.getByRole('button', { name: 'Confirmar pagamento' }))
      expect(create).toHaveBeenCalledTimes(1)
      expect(randomUUID).toHaveBeenCalledTimes(1)
      expect(inputs[0]).toMatchObject({ orderId: orderDetailsFixture.id, idempotencyKey: key, body: {} })
      expect(Object.isFrozen(inputs[0].body)).toBe(true)
      resolveAttempt(paymentPaidFixture)
      expect(await screen.findByText('Pagamento aprovado.')).toBeInTheDocument()
    } finally { randomUUID.mockRestore() }
  })

  it('APPROVED atualiza Payment, pede GET Order e mantém sucesso mesmo se esse refresh falhar', async () => {
    const onOrderRefresh = vi.fn(async () => { throw new Error('offline') })
    renderPanel({ service: serviceWith(async () => null), onOrderRefresh })
    await confirmPayment()
    expect(await screen.findByText('Pagamento aprovado.')).toBeInTheDocument()
    expect(screen.getByText(/pagamento foi atualizado, mas não foi possível atualizar o pedido/i)).toBeInTheDocument()
    expect(onOrderRefresh).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Pagar pedido|Tentar novo pagamento/ })).not.toBeInTheDocument()
  })

  it.each([
    [paymentPendingRejectedFixture, 'não foi aprovado'],
    [paymentPendingErrorFixture, 'Não foi possível processar'],
    [paymentPendingExpiredFixture, 'expirou'],
    [{ ...paymentPendingRejectedFixture, latestAttempt: { ...paymentPendingRejectedFixture.latestAttempt!, status: 'CANCELLED' as const } }, 'foi cancelada'],
  ])('estado terminal %s permite nova confirmação com uma nova key', async (payment, message) => {
    const create = vi.fn(async (_input: CreatePaymentAttemptInput) => paymentPaidFixture)
    renderPanel({ payment, service: serviceWith(async () => payment, create) })
    expect(await screen.findByText(new RegExp(message))).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novo pagamento' }))
    expect(create).not.toHaveBeenCalled()
    await userEvent.click(screen.getByRole('button', { name: 'Confirmar pagamento' }))
    await waitFor(() => expect(create).toHaveBeenCalledTimes(1))
    expect(create.mock.calls[0][0].idempotencyKey).toMatch(/^[0-9a-f-]{36}$/i)
  })

  it('PROCESSING/CREATED bloqueia novo POST e atualização manual faz somente GET até PAID', async () => {
    let gets = 0
    const create = vi.fn(async () => paymentPaidFixture)
    const service = serviceWith(async () => (++gets === 1 ? paymentProcessingFixture : paymentPaidFixture), create)
    const onOrderRefresh = vi.fn(async () => paidOrder)
    renderPanel({ service, onOrderRefresh })
    expect(await screen.findByText('Pagamento em processamento.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar status' }))
    expect(await screen.findByText('Pagamento aprovado.')).toBeInTheDocument()
    expect(gets).toBe(2)
    expect(create).not.toHaveBeenCalled()
    expect(onOrderRefresh).toHaveBeenCalledTimes(1)
  })

  it('CREATED é ativo e uma resposta 201 PROCESSING passa a usar somente GET', async () => {
    const created = { ...paymentProcessingFixture, latestAttempt: { ...paymentProcessingFixture.latestAttempt!, status: 'CREATED' as const } }
    let gets = 0
    const create = vi.fn(async () => paymentProcessingFixture)
    const service = serviceWith(async () => (++gets === 1 ? null : created), create)
    renderPanel({ service })
    await confirmPayment()
    expect(await screen.findByText('Pagamento em processamento.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pagar pedido|Tentar novo pagamento/ })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar status' }))
    expect(await screen.findByText('Preparando o pagamento.')).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
    expect(gets).toBe(2)
  })

  it.each([
    ['network', new ApiClientError('offline', 'network')],
    ['timeout', new ApiClientError('slow', 'timeout')],
  ])('%s incerto reutiliza mesma key e mesmo body até replay 200', async (_kind, initialError) => {
    const inputs: FrozenPaymentAttempt[] = []
    let calls = 0
    const create = vi.fn(async (input: CreatePaymentAttemptInput) => {
      inputs.push(input as FrozenPaymentAttempt)
      calls += 1
      if (calls === 1) throw initialError
      return paymentPaidFixture
    })
    renderPanel({ service: serviceWith(async () => null, create) })
    await confirmPayment()
    expect(await screen.findByText(/pode ter sido processada/)).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Pagamento aprovado.')).toBeInTheDocument()
    expect(inputs).toHaveLength(2)
    expect(inputs[1].idempotencyKey).toBe(inputs[0].idempotencyKey)
    expect(inputs[1].body).toBe(inputs[0].body)
  })

  it('ORDER_NOT_PAYABLE sincroniza Payment e Order sem novo POST', async () => {
    let gets = 0
    const create = vi.fn(async () => { throw new ApiClientError('conflict', 'http', 409, 'ORDER_NOT_PAYABLE') })
    const onOrderRefresh = vi.fn(async () => cancelledOrder)
    renderPanel({ service: serviceWith(async () => (++gets === 1 ? null : paymentCancelledFixture), create), onOrderRefresh })
    await confirmPayment()
    expect(await screen.findByText('Pagamento cancelado.')).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
    expect(onOrderRefresh).toHaveBeenCalledTimes(1)
    expect(screen.queryByRole('button', { name: /Pagar pedido|Tentar novo pagamento/ })).not.toBeInTheDocument()
  })

  it('504 sincroniza PROCESSING por GET, encerra redispatch e mantém refresh manual', async () => {
    let gets = 0
    const create = vi.fn(async () => { throw new ApiClientError('timeout', 'http', 504, 'PAYMENT_PROVIDER_TIMEOUT') })
    renderPanel({ service: serviceWith(async () => (++gets === 1 ? null : paymentProcessingFixture), create) })
    await confirmPayment()
    expect(await screen.findByText('Pagamento em processamento.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Tentar novamente' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Atualizar status' })).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it.each([
    ['PAYMENT_ALREADY_PROCESSING', paymentProcessingFixture, 'Pagamento em processamento.'],
    ['PAYMENT_ALREADY_PAID', paymentPaidFixture, 'Pagamento aprovado.'],
    ['PAYMENT_STATE_CONFLICT', paymentProcessingFixture, 'Pagamento em processamento.'],
  ])('409 %s converge por GET sem segundo POST', async (code, synced, message) => {
    let gets = 0
    const create = vi.fn(async () => { throw new ApiClientError('conflict', 'http', 409, code) })
    const onOrderRefresh = vi.fn(async () => synced.status === 'PAID' ? paidOrder : orderDetailsFixture)
    renderPanel({ service: serviceWith(async () => (++gets === 1 ? null : synced), create), onOrderRefresh })
    await confirmPayment()
    expect(await screen.findByText(message)).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
    expect(gets).toBe(2)
  })

  it('idempotency reused exige GET antes de liberar nova ação', async () => {
    let gets = 0
    const create = vi.fn(async () => { throw new ApiClientError('reused', 'http', 409, 'PAYMENT_IDEMPOTENCY_KEY_REUSED') })
    renderPanel({ service: serviceWith(async () => { gets += 1; return null }, create) })
    await confirmPayment()
    expect(await screen.findByText(/Atualize o status antes de tentar novamente/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Pagar pedido' })).not.toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: 'Atualizar status' }))
    expect(await screen.findByRole('button', { name: 'Pagar pedido' })).toBeInTheDocument()
    expect(gets).toBe(2)
    expect(create).toHaveBeenCalledTimes(1)
  })

  it.each([
    [429, 'RATE_LIMITED', 'Muitas tentativas'],
    [503, 'PAYMENT_PROVIDER_UNAVAILABLE', 'temporariamente indisponível'],
  ])('HTTP %s mostra erro localizado, sem retry automático', async (status, code, message) => {
    const create = vi.fn(async () => { throw new ApiClientError('private', 'http', status as number, String(code)) })
    renderPanel({ service: serviceWith(async () => null, create) })
    await confirmPayment()
    expect(await screen.findByRole('alert')).toHaveTextContent(message as string)
    expect(screen.queryByText('private')).not.toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('502 só permite nova tentativa após GET confirmar ERROR terminal', async () => {
    let gets = 0
    const create = vi.fn(async () => { throw new ApiClientError('private', 'http', 502, 'PAYMENT_PROVIDER_ERROR') })
    renderPanel({ service: serviceWith(async () => (++gets === 1 ? null : paymentPendingErrorFixture), create) })
    await confirmPayment()
    expect(await screen.findByText(/Não foi possível processar o pagamento/)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Tentar novo pagamento' })).toBeInTheDocument()
    expect(create).toHaveBeenCalledTimes(1)
  })

  it('falha GET fica localizada e retry GET recupera sem criar Attempt', async () => {
    let gets = 0
    const create = vi.fn(async () => paymentPaidFixture)
    const service = serviceWith(async () => {
      gets += 1
      if (gets === 1) throw new ApiClientError('offline', 'network')
      return null
    }, create)
    renderPanel({ service })
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível carregar o status do pagamento')
    await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
    expect(await screen.findByText('Este pedido ainda não foi pago.')).toBeInTheDocument()
    expect(create).not.toHaveBeenCalled()
  })

  it('PAID/CANCELLED em reload não oferece ação nem grava Payment em Web Storage', async () => {
    const initialLocal = Object.keys(localStorage)
    const initialSession = Object.keys(sessionStorage)
    const { unmount } = renderPanel({ order: paidOrder, payment: paymentPaidFixture })
    expect(await screen.findByText('Pagamento aprovado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument()
    unmount()
    renderPanel({ order: cancelledOrder, payment: paymentCancelledFixture })
    expect(await screen.findByText('Pagamento cancelado.')).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /Pagar/ })).not.toBeInTheDocument()
    expect(Object.keys(localStorage)).toEqual(initialLocal)
    expect(Object.keys(sessionStorage)).toEqual(initialSession)
  })
})
