import { AlertTriangle, ArrowLeft, CheckCircle2, PackageOpen, ShieldCheck } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { ApiClientError } from '../../api/httpClient'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncStates'
import { useAuth } from '../../contexts/AuthContext'
import { useCart } from '../../contexts/CartContext'
import { customerService, type CustomerService } from '../../services/customerService'
import { orderService, type OrderService } from '../../services/orderService'
import type { CustomerProfile, Dependent } from '../../types/customer'
import type { CheckoutIntentItem, CheckoutPreview, CreateOrderInput } from '../../types/order'
import {
  allRecipientSlotsFilled,
  buildCheckoutItems,
  cartItemKey,
  checkoutStateSignature,
  formatOrderBirthDate,
  formatOrderMoney,
  priceChanged,
  type RecipientSelections,
} from '../../utils/order'
import './checkout.css'

type ReviewState = { data: CheckoutPreview; items: CheckoutIntentItem[]; signature: string }

function checkoutError(failure: unknown, operation: 'preview' | 'create') {
  if (!(failure instanceof ApiClientError)) return 'Não foi possível concluir a solicitação. Tente novamente.'
  if (failure.kind === 'network' || failure.kind === 'timeout') {
    return operation === 'create'
      ? 'Não foi possível confirmar a resposta do servidor. Você pode tentar novamente sem criar um novo pedido.'
      : 'Não foi possível carregar a revisão. Verifique sua conexão e tente novamente.'
  }
  if (failure.code === 'PROFILE_REQUIRED') return 'Complete os dados do responsável antes de continuar.'
  if (failure.code === 'PRODUCT_UNAVAILABLE') return 'Um item do carrinho não está mais disponível. Revise o carrinho ou volte ao catálogo.'
  if (failure.code === 'RECIPIENT_NOT_FOUND') return 'Um destinatário não está mais disponível. Atualize os dados e revise o pedido.'
  if (failure.code === 'CHECKOUT_CHANGED') return 'O checkout foi atualizado. Revise os dados antes de confirmar.'
  if (failure.code === 'IDEMPOTENCY_KEY_REUSED') return 'Não foi possível reutilizar esta tentativa. Revise o pedido antes de confirmar novamente.'
  if (failure.code === 'RATE_LIMITED' || failure.status === 429) return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  if (failure.code === 'DEPENDENCY_UNAVAILABLE' || failure.status === 503) return 'O serviço está temporariamente indisponível. Tente novamente quando estiver pronto.'
  if (failure.status === 401) return 'Sua sessão não é mais válida. Estamos verificando seu acesso.'
  if (failure.status === 403) return 'Sua conta não tem permissão para realizar esta ação.'
  if (failure.status === 422) return 'Não foi possível validar o pedido. Revise os dados e tente novamente.'
  return 'Não foi possível concluir a solicitação. Tente novamente.'
}

export function CheckoutPage({
  customers = customerService,
  orders = orderService,
}: { customers?: CustomerService; orders?: OrderService }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const { items, clearCart } = useCart()
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(true)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileReload, setProfileReload] = useState(0)
  const [dependents, setDependents] = useState<Dependent[]>([])
  const [dependentsLoading, setDependentsLoading] = useState(true)
  const [dependentsError, setDependentsError] = useState<string | null>(null)
  const [dependentsReload, setDependentsReload] = useState(0)
  const [selections, setSelections] = useState<RecipientSelections>({})
  const [review, setReview] = useState<ReviewState | null>(null)
  const [attempt, setAttempt] = useState<CreateOrderInput | null>(null)
  const [previewing, setPreviewing] = useState(false)
  const [creating, setCreating] = useState(false)
  const [feedback, setFeedback] = useState<string | null>(null)
  const feedbackRef = useRef<HTMLDivElement>(null)
  const cartSignature = useMemo(() => JSON.stringify(items.map(({ type, id, name, price, quantity }) => ({ type, id, name, price, quantity }))), [items])
  const previousCartSignature = useRef(cartSignature)

  useEffect(() => {
    let active = true
    setProfileLoading(true)
    setProfileError(null)
    customers.getProfile().then((value) => { if (active) setProfile(value) }).catch((failure: unknown) => {
      if (active) setProfileError(checkoutError(failure, 'preview'))
      if (failure instanceof ApiClientError && failure.status === 401) void auth.retry()
    }).finally(() => { if (active) setProfileLoading(false) })
    return () => { active = false }
  // auth.retry is intentionally used only after an unauthorized API response.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, profileReload])

  useEffect(() => {
    let active = true
    setDependentsLoading(true)
    setDependentsError(null)
    customers.listDependents({ page: 1, pageSize: 100 }).then((value) => { if (active) setDependents(value.items) }).catch((failure: unknown) => {
      if (active) setDependentsError(checkoutError(failure, 'preview'))
      if (failure instanceof ApiClientError && failure.status === 401) void auth.retry()
    }).finally(() => { if (active) setDependentsLoading(false) })
    return () => { active = false }
  // auth.retry is intentionally used only after an unauthorized API response.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customers, dependentsReload])

  useEffect(() => {
    const changed = previousCartSignature.current !== cartSignature
    previousCartSignature.current = cartSignature
    setSelections((current) => Object.fromEntries(items.map((item) => {
      const existing = current[cartItemKey(item)] ?? []
      return [cartItemKey(item), Array.from({ length: item.quantity }, (_, index) => existing[index] ?? '')]
    })))
    if (changed && (review || attempt)) {
      setReview(null)
      setAttempt(null)
      setFeedback('O carrinho mudou. Revise novamente o pedido.')
    }
  // React state is synchronized with the external CartContext shape.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cartSignature])

  useEffect(() => { if (feedback) feedbackRef.current?.focus() }, [feedback])

  const signature = checkoutStateSignature(items, selections)
  const complete = allRecipientSlotsFilled(items, selections)
  const reviewCurrent = review?.signature === signature

  const selectRecipient = (key: string, index: number, value: string) => {
    if (attempt) return
    setSelections((current) => ({
      ...current,
      [key]: (current[key] ?? []).map((entry, slot) => slot === index ? value : entry),
    }))
    if (review) {
      setReview(null)
      setFeedback('Os destinatários mudaram. Revise novamente o pedido.')
    } else setFeedback(null)
  }

  const loadPreview = async () => {
    if (!complete || previewing || creating || !profile) return
    const intent = buildCheckoutItems(items, selections)
    setPreviewing(true)
    setFeedback(null)
    setAttempt(null)
    try {
      const data = await orders.previewCheckout(intent)
      setReview({ data, items: intent, signature: checkoutStateSignature(items, selections) })
    } catch (failure) {
      setFeedback(checkoutError(failure, 'preview'))
      setReview(null)
      if (failure instanceof ApiClientError) {
        if (failure.status === 401) void auth.retry()
        if (failure.code === 'PROFILE_REQUIRED') setProfile(null)
        if (failure.code === 'RECIPIENT_NOT_FOUND') setDependentsReload((value) => value + 1)
      }
    } finally { setPreviewing(false) }
  }

  const confirmOrder = async () => {
    if (!review || !reviewCurrent || creating) return
    const frozenAttempt = attempt ?? {
      items: review.items,
      checkoutFingerprint: review.data.checkoutFingerprint,
      checkoutFingerprintVersion: review.data.checkoutFingerprintVersion,
      idempotencyKey: crypto.randomUUID(),
    }
    if (!attempt) setAttempt(frozenAttempt)
    setCreating(true)
    setFeedback(null)
    try {
      const order = await orders.createOrder(frozenAttempt)
      setAttempt(null)
      clearCart()
      navigate(`/pedidos/${order.id}`, { replace: true, state: { created: true } })
    } catch (failure) {
      setFeedback(checkoutError(failure, 'create'))
      if (failure instanceof ApiClientError) {
        if (failure.status === 401) void auth.retry()
        if (['CHECKOUT_CHANGED', 'PRODUCT_UNAVAILABLE', 'RECIPIENT_NOT_FOUND', 'PROFILE_REQUIRED', 'IDEMPOTENCY_KEY_REUSED'].includes(failure.code ?? '') || failure.status === 422) {
          setAttempt(null)
          setReview(null)
        }
        if (failure.code === 'RECIPIENT_NOT_FOUND') setDependentsReload((value) => value + 1)
        if (failure.code === 'PROFILE_REQUIRED') setProfile(null)
      }
    } finally { setCreating(false) }
  }

  if (items.length === 0) return <section className="container checkout-page">
    <header className="checkout-heading"><p className="eyebrow">Finalização</p><h1>Checkout</h1></header>
    <EmptyState title="Seu carrinho está vazio" message="Adicione vacinas ou pacotes antes de iniciar um pedido." />
    <Link className="button button-primary checkout-back" to="/produtos">Ir ao catálogo</Link>
  </section>

  return <section className="container checkout-page" aria-busy={previewing || creating}>
    <header className="checkout-heading"><p className="eyebrow">Finalização segura</p><h1>Checkout</h1><p>Escolha um destinatário para cada unidade antes de revisar os valores atuais.</p></header>
    {feedback && <div className="checkout-feedback" role="alert" tabIndex={-1} ref={feedbackRef}><AlertTriangle aria-hidden="true" /><span>{feedback}</span></div>}

    <section className="checkout-section" aria-labelledby="recipient-title">
      <div className="checkout-section-heading"><div><h2 id="recipient-title">Destinatários</h2><p>As escolhas ficam somente nesta tela e não são salvas no navegador.</p></div><ShieldCheck aria-hidden="true" /></div>
      {profileLoading && <LoadingState label="Carregando perfil do responsável..." />}
      {profileError && !profileLoading && <ErrorState message={profileError} onRetry={() => setProfileReload((value) => value + 1)} />}
      {!profileLoading && !profileError && !profile && <div className="checkout-onboarding"><h3>Complete os dados do responsável</h3><p>Seu perfil é necessário para identificar os destinatários e criar o pedido.</p><Link className="button button-primary" to="/minha-conta">Ir para Minha conta</Link></div>}
      {dependentsLoading && <LoadingState label="Carregando dependentes..." />}
      {dependentsError && !dependentsLoading && <ErrorState message={dependentsError} onRetry={() => setDependentsReload((value) => value + 1)} />}

      {profile && !profileLoading && !profileError && !dependentsLoading && !dependentsError && <div className="checkout-products">
        {items.map((cartItem) => {
          const key = cartItemKey(cartItem)
          return <article className="checkout-product" key={key}>
            <div className="checkout-product-title"><span>{cartItem.type === 'vaccine' ? 'Vacina' : 'Pacote'}</span><h3>{cartItem.name}</h3><p>Quantidade: <strong>{cartItem.quantity}</strong> · referência do carrinho: {formatOrderMoney(cartItem.price.toFixed(2))}</p></div>
            <div className="recipient-grid">
              {Array.from({ length: cartItem.quantity }, (_, index) => <div className="recipient-field" key={`${key}:${index}`}>
                <label htmlFor={`recipient-${cartItem.type}-${cartItem.id}-${index}`}>Destinatário {index + 1}</label>
                <select id={`recipient-${cartItem.type}-${cartItem.id}-${index}`} value={selections[key]?.[index] ?? ''}
                  onChange={(event) => selectRecipient(key, index, event.target.value)} disabled={previewing || creating || attempt !== null}>
                  <option value="">Selecionar</option>
                  <option value="CUSTOMER">{profile.name} — responsável</option>
                  {dependents.map((dependent) => <option key={dependent.id} value={`DEPENDENT:${dependent.id}`}>{dependent.name} — dependente</option>)}
                </select>
              </div>)}
            </div>
          </article>
        })}
        {dependents.length === 0 && <p className="checkout-note">Nenhum dependente ativo. O próprio responsável continua disponível como destinatário.</p>}
        <button className="button button-primary" type="button" onClick={() => { void loadPreview() }} disabled={!complete || previewing || creating || attempt !== null}>
          {previewing ? 'Preparando revisão...' : 'Revisar pedido'}
        </button>
        {!complete && <p className="checkout-note" role="status">Preencha todos os destinatários para continuar.</p>}
      </div>}
    </section>

    {review && reviewCurrent && <section className="checkout-section checkout-review" aria-labelledby="review-title">
      <div className="checkout-section-heading"><div><h2 id="review-title">Revisão do pedido</h2><p>Valores e dados confirmados agora pela API.</p></div><CheckCircle2 aria-hidden="true" /></div>
      <div className="review-items">{review.data.items.map((reviewItem) => {
        const cartItem = items.find((value) => value.id === reviewItem.productId && (value.type === 'vaccine') === (reviewItem.productType === 'VACCINE'))
        const changed = cartItem ? priceChanged(cartItem.price, reviewItem.unitPrice) : false
        return <article className="review-item" key={`${reviewItem.productType}:${reviewItem.productId}`}>
          <div><span>{reviewItem.productType === 'VACCINE' ? 'Vacina' : 'Pacote'}</span><h3>{reviewItem.name}</h3>{reviewItem.manufacturer && <p>Fabricante: {reviewItem.manufacturer}</p>}</div>
          {changed && cartItem && <p className="price-change" role="status">O preço deste item foi atualizado de {formatOrderMoney(cartItem.price.toFixed(2))} para {formatOrderMoney(reviewItem.unitPrice)}.</p>}
          <dl className="review-values"><div><dt>Preço unitário</dt><dd>{formatOrderMoney(reviewItem.unitPrice)}</dd></div><div><dt>Quantidade</dt><dd>{reviewItem.quantity}</dd></div><div><dt>Total</dt><dd>{formatOrderMoney(reviewItem.lineTotal)}</dd></div></dl>
          <div className="review-recipients"><h4>Destinatários</h4><ul>{reviewItem.recipients.map((recipient, index) => <li key={`${recipient.type}:${recipient.dependentId ?? 'customer'}:${index}`}>{recipient.name}{recipient.birthDate ? ` — nascimento ${formatOrderBirthDate(recipient.birthDate)}` : ' — responsável'}</li>)}</ul></div>
          {reviewItem.productType === 'PACKAGE' && <div className="review-components"><h4><PackageOpen size={18} aria-hidden="true" /> Vacinas incluídas</h4><ul>{reviewItem.components.map((component) => <li key={component.vaccineId}><span>{component.name} — {component.manufacturer}</span><strong>{component.quantity} por pacote</strong></li>)}</ul></div>}
        </article>
      })}</div>
      <div className="review-total"><span>Total em {review.data.currency}</span><strong>{formatOrderMoney(review.data.totalAmount)}</strong></div>
      <div className="checkout-actions"><Link className="button button-secondary" to="/carrinho"><ArrowLeft size={18} aria-hidden="true" /> Voltar ao carrinho</Link>
        <button className="button button-primary" type="button" onClick={() => { void confirmOrder() }} disabled={creating}>{creating ? 'Confirmando pedido...' : attempt ? 'Tentar novamente' : 'Confirmar pedido'}</button></div>
      {attempt && !creating && <p className="checkout-note" role="status">Esta tentativa está protegida contra duplicação. Tentar novamente reutilizará exatamente os mesmos dados.</p>}
      <p className="checkout-note">Se você recarregou a página após uma resposta incerta, consulte Meus pedidos antes de confirmar novamente.</p>
    </section>}
  </section>
}
