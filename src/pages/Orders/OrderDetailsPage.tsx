import { ArrowLeft, CheckCircle2, PackageOpen } from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import { Link, useLocation, useParams } from 'react-router-dom'
import { ApiClientError } from '../../api/httpClient'
import { ErrorState, LoadingState } from '../../components/common/AsyncStates'
import { PaymentPanel } from '../../components/orders/PaymentPanel'
import { useAuth } from '../../contexts/AuthContext'
import { orderService, type OrderService } from '../../services/orderService'
import type { OrderDetails } from '../../types/order'
import type { Payment } from '../../types/payment'
import { formatPhone } from '../../utils/customer'
import { formatOrderBirthDate, formatOrderDate, formatOrderMoney, orderStatusLabel, ordersError } from '../../utils/order'
import { paymentAllowsNewAttempt } from '../../utils/payment'
import './orders.css'

export function OrderDetailsPage({ service = orderService }: { service?: OrderService }) {
  const { id = '' } = useParams()
  const location = useLocation()
  const auth = useAuth()
  const [order, setOrder] = useState<OrderDetails | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)
  const [confirmingCancel, setConfirmingCancel] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const [cancelError, setCancelError] = useState<string | null>(null)
  const [payment, setPayment] = useState<Payment | null>(null)
  const [paymentResolved, setPaymentResolved] = useState(false)
  const [paymentRefreshToken, setPaymentRefreshToken] = useState(0)
  const confirmButton = useRef<HTMLButtonElement>(null)
  const mountedRef = useRef(true)
  const currentOrderIdRef = useRef(id)
  currentOrderIdRef.current = id
  const created = Boolean((location.state as { created?: boolean } | null)?.created)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    setPaymentResolved(false)
    service.getOrder(id).then((value) => { if (active) setOrder(value) }).catch((failure: unknown) => {
      if (active) setError(ordersError(failure))
      if (failure instanceof ApiClientError && failure.status === 401) void auth.retry()
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  // auth.retry is intentionally used only after an unauthorized API response.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id, reload, service])

  useEffect(() => { if (confirmingCancel) confirmButton.current?.focus() }, [confirmingCancel])
  useEffect(() => {
    mountedRef.current = true
    return () => { mountedRef.current = false }
  }, [])

  const refreshOrder = async () => {
    try {
      const value = await service.getOrder(id)
      if (mountedRef.current && currentOrderIdRef.current === id) setOrder(value)
      return value
    } catch (failure) {
      if (failure instanceof ApiClientError && failure.status === 401) void auth.retry()
      throw failure
    }
  }

  const cancel = async () => {
    if (!order || cancelling) return
    setCancelling(true)
    setCancelError(null)
    try {
      setOrder(await service.cancelOrder(order.id))
      setConfirmingCancel(false)
      setPaymentRefreshToken((value) => value + 1)
    } catch (failure) {
      setCancelError(ordersError(failure))
      if (failure instanceof ApiClientError) {
        if (failure.status === 401) void auth.retry()
        if (failure.code === 'ORDER_NOT_CANCELLABLE') {
          setCancelError('O estado do pedido foi atualizado. Os dados serão sincronizados.')
          setReload((value) => value + 1)
          setPaymentRefreshToken((value) => value + 1)
        }
        if (failure.status === 404) setError('Pedido não encontrado.')
      }
    } finally { setCancelling(false) }
  }

  return <section className="container orders-page order-details-page">
    <Link className="orders-back" to="/pedidos"><ArrowLeft size={17} aria-hidden="true" /> Meus pedidos</Link>
    {created && <div className="order-created" role="status"><CheckCircle2 aria-hidden="true" /> Pedido confirmado com sucesso.</div>}
    {loading ? <LoadingState label="Carregando pedido..." />
      : error || !order ? <ErrorState message={error ?? 'Pedido não encontrado.'} onRetry={error !== 'Pedido não encontrado.' ? () => setReload((value) => value + 1) : undefined} />
        : <>
          <header className="order-detail-heading"><div><p className="eyebrow">Pedido</p><h1>{order.number}</h1><p>Criado em <time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time></p></div><div className="order-detail-total"><span className={`order-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order.status)}</span><strong>{formatOrderMoney(order.totalAmount)}</strong></div></header>

          <section className="order-section" aria-labelledby="historical-customer"><h2 id="historical-customer">Dados do pedido</h2><p className="historical-note">Estes são os dados históricos registrados na confirmação, não necessariamente o perfil atual.</p>
            <dl className="order-customer"><div><dt>Responsável</dt><dd>{order.customer.name}</dd></div><div><dt>Email</dt><dd>{order.customer.email}</dd></div><div><dt>Telefone</dt><dd>{formatPhone(order.customer.phone)}</dd></div></dl>
          </section>

          <section className="order-section" aria-labelledby="order-items"><h2 id="order-items">Itens</h2><div className="detail-items">{order.items.map((item) => <article className="detail-item" key={`${item.productType}:${item.productId}`}>
            <div><span>{item.productType === 'VACCINE' ? 'Vacina' : 'Pacote'}</span><h3>{item.name}</h3>{item.manufacturer && <p>Fabricante: {item.manufacturer}</p>}</div>
            <dl className="review-values"><div><dt>Preço unitário</dt><dd>{formatOrderMoney(item.unitPrice)}</dd></div><div><dt>Quantidade</dt><dd>{item.quantity}</dd></div><div><dt>Total</dt><dd>{formatOrderMoney(item.lineTotal)}</dd></div></dl>
            <div><h4>Destinatários registrados</h4><ul>{item.recipients.map((recipient, index) => <li key={`${recipient.type}:${recipient.dependentId ?? 'customer'}:${index}`}>{recipient.name}{recipient.birthDate ? <> — nascimento <time dateTime={recipient.birthDate}>{formatOrderBirthDate(recipient.birthDate)}</time></> : ' — responsável'}</li>)}</ul></div>
            {item.productType === 'PACKAGE' && <div className="review-components"><h4><PackageOpen size={18} aria-hidden="true" /> Vacinas incluídas</h4><ul>{item.components.map((component) => <li key={component.vaccineId}><span>{component.name} — {component.manufacturer}</span><strong>{component.quantity} por pacote</strong></li>)}</ul></div>}
          </article>)}</div></section>

          <PaymentPanel order={order} refreshToken={paymentRefreshToken} onOrderRefresh={refreshOrder} onPaymentState={(value, resolved) => { setPayment(value); setPaymentResolved(resolved) }} />

          <section className="order-section order-cancel-section" aria-labelledby="order-actions"><h2 id="order-actions">Ações do pedido</h2>
            {order.status === 'CANCELLED' ? <p>Pedido cancelado{order.cancelledAt ? <> em <time dateTime={order.cancelledAt}>{formatOrderDate(order.cancelledAt)}</time></> : null}.</p>
              : order.status === 'PAID' ? <p>Pedido pago. O cancelamento não está disponível nesta fase demonstrativa.</p>
                : paymentResolved && paymentAllowsNewAttempt(payment) ? (confirmingCancel ? <div className="cancel-confirmation" role="group" aria-label="Confirmação de cancelamento"><strong>Tem certeza de que deseja cancelar este pedido?</strong>{cancelError && <p role="alert">{cancelError}</p>}<div className="checkout-actions"><button className="button button-secondary" type="button" onClick={() => { setConfirmingCancel(false); setCancelError(null) }} disabled={cancelling}>Manter pedido</button><button className="button button-danger" type="button" ref={confirmButton} onClick={() => { void cancel() }} disabled={cancelling}>{cancelling ? 'Cancelando...' : 'Cancelar pedido'}</button></div></div>
                  : <><button className="button button-text-danger" type="button" onClick={() => setConfirmingCancel(true)}>Cancelar pedido</button>{cancelError && <p role="alert">{cancelError}</p>}</>)
                  : <p>{payment?.status === 'PROCESSING' ? 'Não é possível cancelar enquanto o pagamento está em processamento.' : 'Aguarde a confirmação do status do pagamento para gerenciar este pedido.'}</p>}
          </section>
        </>}
  </section>
}
