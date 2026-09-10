import { ArrowRight, ClipboardList } from 'lucide-react'
import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { ApiClientError } from '../../api/httpClient'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncStates'
import { Pagination } from '../../components/catalog/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import { orderService, type OrderService } from '../../services/orderService'
import type { OrderSummary } from '../../types/order'
import { formatOrderDate, formatOrderMoney, orderStatusLabel, ordersError } from '../../utils/order'
import './orders.css'

const PAGE_SIZE = 20
export function OrdersPage({ service = orderService }: { service?: OrderService }) {
  const auth = useAuth()
  const [orders, setOrders] = useState<OrderSummary[]>([])
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(0)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let active = true
    setLoading(true)
    setError(null)
    service.listOrders({ page, pageSize: PAGE_SIZE }).then((result) => {
      if (active) { setOrders(result.items); setTotalPages(result.meta.totalPages) }
    }).catch((failure: unknown) => {
      if (active) setError(ordersError(failure))
      if (failure instanceof ApiClientError && failure.status === 401) void auth.retry()
    }).finally(() => { if (active) setLoading(false) })
    return () => { active = false }
  // auth.retry is intentionally used only after an unauthorized API response.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, reload, service])

  return <section className="container orders-page">
    <header className="orders-heading"><p className="eyebrow">Sua conta</p><h1>Meus pedidos</h1><p>Acompanhe os registros comerciais criados nesta conta.</p></header>
    {loading ? <LoadingState label="Carregando pedidos..." />
      : error ? <ErrorState message={error} onRetry={() => setReload((value) => value + 1)} />
        : orders.length === 0 ? <div className="orders-empty"><EmptyState title="Nenhum pedido encontrado" message="Quando você confirmar um checkout, o pedido aparecerá aqui." /><Link className="button button-primary" to="/produtos">Explorar produtos</Link></div>
          : <><div className="order-list">{orders.map((order) => <article className="order-card" key={order.id}>
            <div className="order-card-icon"><ClipboardList aria-hidden="true" /></div>
            <div><span>Pedido</span><h2>{order.number}</h2><p><time dateTime={order.createdAt}>{formatOrderDate(order.createdAt)}</time> · {order.itemCount} item(ns)</p></div>
            <div className="order-card-summary"><span className={`order-status status-${order.status.toLowerCase()}`}>{orderStatusLabel(order.status)}</span><strong>{formatOrderMoney(order.totalAmount)}</strong></div>
            <Link className="button button-secondary" to={`/pedidos/${order.id}`}>Ver detalhes <ArrowRight size={17} aria-hidden="true" /></Link>
          </article>)}</div><Pagination page={page} totalPages={totalPages} label="pedidos" onChange={setPage} /></>}
  </section>
}
