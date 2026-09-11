import { CheckCircle2, CircleDollarSign, Clock3, RefreshCw, TriangleAlert } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { ApiClientError } from '../../api/httpClient'
import { useAuth } from '../../contexts/AuthContext'
import { paymentService, type PaymentService } from '../../services/paymentService'
import type { OrderDetails } from '../../types/order'
import type { FrozenPaymentAttempt, Payment } from '../../types/payment'
import { formatOrderDate, formatOrderMoney } from '../../utils/order'
import { paymentAllowsNewAttempt, paymentAttemptMessage, paymentError, paymentIsActive } from '../../utils/payment'

interface PaymentPanelProps {
  order: OrderDetails
  refreshToken?: number
  service?: PaymentService
  onOrderRefresh: () => Promise<OrderDetails>
  onPaymentState: (payment: Payment | null, resolved: boolean) => void
}

const UNKNOWN_MESSAGE = 'Não foi possível confirmar a resposta do servidor. A tentativa de pagamento pode ter sido processada.'

export function PaymentPanel({
  order,
  refreshToken = 0,
  service = paymentService,
  onOrderRefresh,
  onPaymentState,
}: PaymentPanelProps) {
  const auth = useAuth()
  const [payment, setPayment] = useState<Payment | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [confirming, setConfirming] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [refreshing, setRefreshing] = useState(false)
  const [unknown, setUnknown] = useState(false)
  const [requiresSync, setRequiresSync] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  const [orderSyncError, setOrderSyncError] = useState<string | null>(null)
  const attemptRef = useRef<FrozenPaymentAttempt | null>(null)
  const submittingRef = useRef(false)
  const mountedRef = useRef(true)
  const confirmButtonRef = useRef<HTMLButtonElement>(null)
  const resultRef = useRef<HTMLDivElement>(null)
  const onPaymentStateRef = useRef(onPaymentState)
  const onOrderRefreshRef = useRef(onOrderRefresh)
  onPaymentStateRef.current = onPaymentState
  onOrderRefreshRef.current = onOrderRefresh

  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])
  useEffect(() => { if (confirming) confirmButtonRef.current?.focus() }, [confirming])
  useEffect(() => {
    if (actionError || payment?.status === 'PAID') resultRef.current?.focus()
  }, [actionError, payment?.status])

  const applyPayment = (value: Payment | null) => {
    if (!mountedRef.current) return
    setPayment(value)
    onPaymentStateRef.current(value, true)
  }

  const refreshOrder = async () => {
    try {
      await onOrderRefreshRef.current()
      if (mountedRef.current) setOrderSyncError(null)
    } catch {
      if (mountedRef.current) setOrderSyncError('O pagamento foi atualizado, mas não foi possível atualizar o pedido. Atualize os dados para confirmar o status do pedido.')
    }
  }

  const getPayment = async ({ initial = false, refreshOrderIfPaid = true } = {}) => {
    if (!initial && mountedRef.current) setRefreshing(true)
    try {
      const value = await service.getPayment(order.id)
      applyPayment(value)
      if (mountedRef.current) {
        setLoadError(null)
        setActionError(null)
        setUnknown(false)
        setRequiresSync(false)
      }
      // A successful GET is authoritative recovery after an uncertain transport result.
      attemptRef.current = null
      if (value?.status === 'PAID' && refreshOrderIfPaid) await refreshOrder()
      return value
    } catch (failure) {
      if (mountedRef.current) {
        const message = 'Não foi possível carregar o status do pagamento.'
        if (initial) {
          setLoadError(message)
          onPaymentStateRef.current(null, false)
        } else setActionError(message)
      }
      if (failure instanceof ApiClientError && failure.status === 401) void auth.retry()
      return undefined
    } finally {
      if (mountedRef.current) {
        setLoading(false)
        setRefreshing(false)
      }
    }
  }

  useEffect(() => {
    let active = true
    setLoading(true)
    setLoadError(null)
    service.getPayment(order.id).then(async (value) => {
      if (!active) return
      applyPayment(value)
      setLoading(false)
      if (value?.status === 'PAID' && order.status !== 'PAID') await refreshOrder()
    }).catch((failure: unknown) => {
      if (!active) return
      setLoading(false)
      setLoadError('Não foi possível carregar o status do pagamento.')
      onPaymentStateRef.current(null, false)
      if (failure instanceof ApiClientError && failure.status === 401) void auth.retry()
    })
    return () => { active = false }
  // State is recovered only when the order changes or the parent explicitly requests synchronization.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [order.id, refreshToken, service])

  const handleKnownConflict = async (failure: ApiClientError) => {
    if (failure.code === 'PAYMENT_ALREADY_PROCESSING') {
      attemptRef.current = null
      await getPayment()
      return true
    }
    if (failure.code === 'PAYMENT_ALREADY_PAID') {
      attemptRef.current = null
      await getPayment({ refreshOrderIfPaid: false })
      await refreshOrder()
      return true
    }
    if (failure.code === 'ORDER_NOT_PAYABLE' || failure.code === 'PAYMENT_STATE_CONFLICT') {
      attemptRef.current = null
      if (mountedRef.current) setActionError(paymentError(failure))
      await Promise.all([getPayment({ refreshOrderIfPaid: false }), refreshOrder()])
      return true
    }
    return false
  }

  const submitAttempt = async (attempt: FrozenPaymentAttempt) => {
    if (submittingRef.current) return
    submittingRef.current = true
    setSubmitting(true)
    setActionError(null)
    setOrderSyncError(null)
    setRequiresSync(false)
    try {
      const value = await service.createPaymentAttempt(attempt)
      attemptRef.current = null
      applyPayment(value)
      setUnknown(false)
      if (value.status === 'PAID') await refreshOrder()
    } catch (failure) {
      const error = failure instanceof ApiClientError ? failure : null
      if (error?.status === 401) void auth.retry()
      if (error && await handleKnownConflict(error)) return

      if (error?.code === 'PAYMENT_IDEMPOTENCY_KEY_REUSED') {
        setRequiresSync(true)
        setActionError(paymentError(error))
      } else if (error?.kind === 'network' || error?.kind === 'timeout' || error?.kind === 'invalid-response' || error?.status === 504) {
        setUnknown(true)
        setActionError(UNKNOWN_MESSAGE)
        if (error.status === 504) await getPayment()
      } else if (error?.status === 502) {
        setUnknown(true)
        setActionError(paymentError(error))
        await getPayment()
      } else {
        // Validation, authorization, rate limiting and a known provider rejection did not
        // produce a reusable transport result. A later user action starts a new attempt.
        attemptRef.current = null
        setActionError(paymentError(failure))
      }
    } finally {
      submittingRef.current = false
      if (mountedRef.current) setSubmitting(false)
    }
  }

  const confirmPayment = () => {
    if (submittingRef.current || attemptRef.current) return
    const attempt: FrozenPaymentAttempt = Object.freeze({
      orderId: order.id,
      idempotencyKey: crypto.randomUUID(),
      body: Object.freeze({}),
    })
    attemptRef.current = attempt
    setConfirming(false)
    void submitAttempt(attempt)
  }

  const retryFrozenAttempt = () => {
    const attempt = attemptRef.current
    if (attempt) void submitAttempt(attempt)
  }

  const active = paymentIsActive(payment)
  const mayPay = order.status === 'PENDING_PAYMENT' && paymentAllowsNewAttempt(payment) && !unknown && !requiresSync && !actionError && !orderSyncError
  const value = payment?.amount ?? order.totalAmount
  const statusMessage = paymentAttemptMessage(payment)

  return <section className="order-section payment-panel" aria-labelledby="payment-heading">
    <div className="payment-heading-row">
      <div><p className="eyebrow">Situação financeira</p><h2 id="payment-heading">Pagamento</h2></div>
      <CircleDollarSign aria-hidden="true" />
    </div>
    <p className="payment-demo-notice"><TriangleAlert size={19} aria-hidden="true" /><strong>Pagamento demonstrativo — nenhuma cobrança real será realizada.</strong></p>

    {loading ? <div className="payment-local-state" role="status">Carregando status do pagamento...</div>
      : loadError ? <div className="payment-local-state" role="alert"><p>{loadError}</p><button className="button button-secondary" type="button" onClick={() => { void getPayment({ initial: true }) }}>Tentar novamente</button></div>
        : <>
          <div className="payment-summary" ref={resultRef} tabIndex={-1}>
            <div className={`payment-state payment-state-${payment?.status.toLowerCase() ?? 'none'}`} role="status">
              {payment?.status === 'PAID' ? <CheckCircle2 aria-hidden="true" /> : <Clock3 aria-hidden="true" />}
              <div><strong>{statusMessage}</strong>
                {payment?.latestAttempt?.provider === 'DEMO' && <span>Pagamento demonstrativo · Tentativa {payment.latestAttempt.sequence}</span>}
              </div>
            </div>
            <dl><div><dt>Valor</dt><dd>{formatOrderMoney(value)}</dd></div>
              {payment?.paidAt && <div><dt>Pago em</dt><dd><time dateTime={payment.paidAt}>{formatOrderDate(payment.paidAt)}</time></dd></div>}
              {payment?.cancelledAt && <div><dt>Cancelado em</dt><dd><time dateTime={payment.cancelledAt}>{formatOrderDate(payment.cancelledAt)}</time></dd></div>}
            </dl>
          </div>

          {actionError && <p className="payment-action-error" role="alert">{actionError}</p>}
          {orderSyncError && <p className="payment-sync-warning" role="alert">{orderSyncError}</p>}

          {confirming && <div className="payment-confirmation" role="dialog" aria-modal="true" aria-labelledby="payment-confirm-title" aria-describedby="payment-confirm-description">
            <h3 id="payment-confirm-title">Confirmar pagamento demonstrativo?</h3>
            <p id="payment-confirm-description">O valor exibido é {formatOrderMoney(value)}. Nenhuma cobrança real será realizada.</p>
            <div className="checkout-actions"><button className="button button-secondary" type="button" onClick={() => setConfirming(false)} disabled={submitting}>Voltar</button><button className="button button-primary" type="button" ref={confirmButtonRef} onClick={confirmPayment} disabled={submitting}>{submitting ? 'Confirmando...' : 'Confirmar pagamento'}</button></div>
          </div>}

          {!confirming && <div className="payment-actions">
            {mayPay && <button className="button button-primary" type="button" onClick={() => setConfirming(true)} disabled={submitting}>{payment ? 'Tentar novo pagamento' : 'Pagar pedido'}</button>}
            {unknown && attemptRef.current && <button className="button button-primary" type="button" onClick={retryFrozenAttempt} disabled={submitting}>{submitting ? 'Tentando novamente...' : 'Tentar novamente'}</button>}
            {(active || unknown || requiresSync || actionError || orderSyncError) && <button className="button button-secondary" type="button" onClick={() => { void getPayment() }} disabled={refreshing || submitting}><RefreshCw size={17} aria-hidden="true" /> {refreshing ? 'Atualizando...' : 'Atualizar status'}</button>}
          </div>}

          {active && order.status === 'PENDING_PAYMENT' && <p className="payment-processing-note">Não é possível cancelar enquanto o pagamento está em processamento.</p>}
        </>}
  </section>
}
