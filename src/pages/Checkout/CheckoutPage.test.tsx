import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { delay, http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../../api/httpClient'
import { CART_STORAGE_KEY, useCart } from '../../contexts/CartContext'
import { checkoutPreviewFixture, customerProfileFixture, dependentFixture, orderDetailsFixture, packageFixture, vaccineFixture } from '../../test/fixtures'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import type { CheckoutPreview } from '../../types/order'
import { CheckoutPage } from './CheckoutPage'

const customer = { id: 'customer-1', email: 'cliente@example.test', role: 'CUSTOMER', status: 'ACTIVE' }
const success = <T,>(data: T, status = 200) => HttpResponse.json({ data, error: null }, { status })
const failure = (status: number, code: string) => HttpResponse.json({ data: null, error: { code, message: 'private backend stack' } }, { status })
const cart = [
  { type: 'vaccine', id: vaccineFixture.id, name: vaccineFixture.name, price: 249.9, quantity: 2 },
  { type: 'package', id: packageFixture.id, name: packageFixture.name, price: 399, quantity: 1 },
]
const singleCart = [{ type: 'vaccine', id: vaccineFixture.id, name: vaccineFixture.name, price: 249.9, quantity: 1 }]
const singlePreview: CheckoutPreview = {
  ...checkoutPreviewFixture,
  items: [{
    ...checkoutPreviewFixture.items[0],
    quantity: 1,
    lineTotal: checkoutPreviewFixture.items[0].unitPrice,
    recipients: [checkoutPreviewFixture.items[0].recipients[0]],
  }],
  totalAmount: checkoutPreviewFixture.items[0].unitPrice,
}

function authenticate() {
  server.use(http.get(API_BASE_URL + '/auth/me', () => success(customer)))
}
function customerData(profile: typeof customerProfileFixture | null = customerProfileFixture, dependents = [dependentFixture]) {
  server.use(
    http.get(API_BASE_URL + '/profile', () => success(profile)),
    http.get(API_BASE_URL + '/dependents', () => HttpResponse.json({ data: dependents, meta: { page: 1, pageSize: 100, total: dependents.length, totalPages: dependents.length ? 1 : 0 }, error: null })),
  )
}
function mount(ui = <CheckoutPage />) {
  return renderWithProviders(<Routes>
    <Route path="/checkout" element={ui} />
    <Route path="/pedidos/:id" element={<h1>Detalhe alcançado</h1>} />
    <Route path="/minha-conta" element={<h1>Minha conta</h1>} />
  </Routes>, ['/checkout'])
}
async function fillSingle() {
  await screen.findByLabelText('Destinatário 1')
  await userEvent.selectOptions(screen.getByLabelText('Destinatário 1'), 'CUSTOMER')
}
async function reviewSingle() {
  await fillSingle()
  await userEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
  return screen.findByRole('heading', { name: 'Revisão do pedido' })
}

describe('CheckoutPage — base e preview', () => {
  it('não chama preview com carrinho vazio e oferece o catálogo', async () => {
    authenticate(); customerData()
    let calls = 0
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => { calls += 1; return success(singlePreview) }))
    mount()
    expect(screen.getByText('Seu carrinho está vazio')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir ao catálogo' })).toBeInTheDocument()
    expect(calls).toBe(0)
  })

  it('carrega profile e dependents independentemente e orienta profile ausente', async () => {
    authenticate(); customerData(null, [])
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    mount()
    expect(screen.getByText('Carregando perfil do responsável...')).toBeInTheDocument()
    expect(screen.getByText('Carregando dependentes...')).toBeInTheDocument()
    expect(await screen.findByRole('heading', { name: 'Complete os dados do responsável' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ir para Minha conta' })).toBeInTheDocument()
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
  })

  it('quantity cria slots, permite recipient repetido e envia somente a intenção', async () => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    let body: unknown
    server.use(http.post(API_BASE_URL + '/checkout/preview', async ({ request }) => { body = await request.json(); return success(checkoutPreviewFixture) }))
    mount()
    const slots = await screen.findAllByRole('combobox')
    expect(slots).toHaveLength(3)
    expect(screen.getByRole('button', { name: 'Revisar pedido' })).toBeDisabled()
    await userEvent.selectOptions(slots[0], `DEPENDENT:${dependentFixture.id}`)
    await userEvent.selectOptions(slots[1], `DEPENDENT:${dependentFixture.id}`)
    await userEvent.selectOptions(slots[2], 'CUSTOMER')
    await userEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
    expect(await screen.findByRole('heading', { name: 'Revisão do pedido' })).toBeInTheDocument()
    expect(body).toEqual({ items: [
      { productType: 'VACCINE', productId: vaccineFixture.id, recipients: [{ type: 'DEPENDENT', dependentId: dependentFixture.id }, { type: 'DEPENDENT', dependentId: dependentFixture.id }] },
      { productType: 'PACKAGE', productId: packageFixture.id, recipients: [{ type: 'CUSTOMER' }] },
    ] })
    expect(JSON.stringify(body)).not.toMatch(/price|quantity|name|total|currency|manufacturer/i)
    expect(screen.getByText(/preço deste item foi atualizado/i)).toHaveTextContent('R$ 249,90')
    expect(screen.getByText('Vacinas incluídas')).toBeInTheDocument()
    expect(screen.getByText('2 por pacote')).toBeInTheDocument()
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
  })

  it('sem dependentes ainda oferece CUSTOMER e erro de preview preserva carrinho', async () => {
    authenticate(); customerData(customerProfileFixture, [])
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => failure(409, 'PRODUCT_UNAVAILABLE')))
    mount()
    expect(await screen.findByText(/Nenhum dependente ativo/)).toBeInTheDocument()
    expect(screen.getByRole('option', { name: /responsável/ })).toBeInTheDocument()
    await fillSingle()
    await userEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('não está mais disponível')
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
  })

  it('mostra loading acessível no preview e não alerta quando o preço não mudou', async () => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ ...singleCart[0], price: 259.9 }]))
    server.use(http.post(API_BASE_URL + '/checkout/preview', async () => {
      await delay(50)
      return success(singlePreview)
    }))
    mount(); await fillSingle()
    await userEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
    expect(screen.getByRole('button', { name: 'Preparando revisão...' })).toBeDisabled()
    expect(await screen.findByRole('heading', { name: 'Revisão do pedido' })).toBeInTheDocument()
    expect(screen.queryByText(/preço deste item foi atualizado/i)).not.toBeInTheDocument()
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
  })

  it('mantém recipients, fingerprint, tentativa e snapshots fora do Web Storage', async () => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => success(singlePreview)))
    mount(); await reviewSingle()
    expect(Object.keys(localStorage)).toEqual([CART_STORAGE_KEY])
    expect(sessionStorage.length).toBe(0)
    const persisted = `${localStorage.getItem(CART_STORAGE_KEY)}`
    expect(persisted).not.toMatch(/recipient|dependent|fingerprint|idempotency|order|snapshot|birthDate|phone/i)
  })
})

function MutationHarness() {
  const cartState = useCart()
  return <><button onClick={() => cartState.setQuantity('vaccine', vaccineFixture.id, 2)}>Mudar quantidade</button>
    <button onClick={() => cartState.removeItem('vaccine', vaccineFixture.id)}>Remover externo</button>
    <button onClick={() => cartState.addItem({ type: 'package', id: packageFixture.id, name: packageFixture.name, price: 399 })}>Adicionar externo</button>
    <CheckoutPage /></>
}

describe('CheckoutPage — invalidação', () => {
  it('alterar recipient invalida preview', async () => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => success(singlePreview)))
    mount()
    await reviewSingle()
    await userEvent.selectOptions(screen.getByLabelText('Destinatário 1'), `DEPENDENT:${dependentFixture.id}`)
    expect(screen.queryByRole('heading', { name: 'Revisão do pedido' })).not.toBeInTheDocument()
    expect(screen.getByRole('alert')).toHaveTextContent('destinatários mudaram')
  })

  it.each(['Mudar quantidade', 'Remover externo', 'Adicionar externo'])('%s invalida preview do carrinho', async (action) => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => success(singlePreview)))
    mount(<MutationHarness />)
    await reviewSingle()
    await userEvent.click(screen.getByRole('button', { name: action }))
    await waitFor(() => expect(screen.queryByRole('heading', { name: 'Revisão do pedido' })).not.toBeInTheDocument())
    if (action !== 'Remover externo') expect(await screen.findByRole('alert')).toHaveTextContent('carrinho mudou')
  })
})

describe('CheckoutPage — create e idempotência', () => {
  it.each([201, 200])('sucesso %s usa UUID/header, limpa Cart e navega ao mesmo Order', async (status) => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => success(singlePreview)))
    const key = '70000000-0000-4000-8000-000000000001'
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(key)
    let requestKey: string | null = null
    let body: unknown
    server.use(http.post(API_BASE_URL + '/orders', async ({ request }) => {
      requestKey = request.headers.get('Idempotency-Key'); body = await request.json()
      return success(orderDetailsFixture, status)
    }))
    try {
      mount(); await reviewSingle()
      expect(uuid).not.toHaveBeenCalled()
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
      expect(await screen.findByRole('heading', { name: 'Detalhe alcançado' })).toBeInTheDocument()
      expect(requestKey).toBe(key)
      expect(body).toEqual({ items: [{ productType: 'VACCINE', productId: vaccineFixture.id, recipients: [{ type: 'CUSTOMER' }] }], checkoutFingerprint: singlePreview.checkoutFingerprint, checkoutFingerprintVersion: 1 })
      expect(JSON.stringify(body)).not.toMatch(/unitPrice|lineTotal|totalAmount|manufacturer|quantity|name/)
      await waitFor(() => expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull())
      expect(sessionStorage.length).toBe(0)
    } finally { uuid.mockRestore() }
  })

  it('network retry reutiliza exatamente a mesma key e body até replay 200', async () => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => success(singlePreview)))
    const key = '70000000-0000-4000-8000-000000000002'
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue(key)
    const requests: Array<{ key: string | null; body: unknown }> = []
    server.use(http.post(API_BASE_URL + '/orders', async ({ request }) => {
      requests.push({ key: request.headers.get('Idempotency-Key'), body: await request.json() })
      return requests.length === 1 ? HttpResponse.error() : success(orderDetailsFixture, 200)
    }))
    try {
      mount(); await reviewSingle()
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('sem criar um novo pedido')
      expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
      expect(screen.getByLabelText('Destinatário 1')).toBeDisabled()
      await userEvent.click(screen.getByRole('button', { name: 'Tentar novamente' }))
      expect(await screen.findByRole('heading', { name: 'Detalhe alcançado' })).toBeInTheDocument()
      expect(requests).toHaveLength(2)
      expect(requests[1]).toEqual(requests[0])
      expect(uuid).toHaveBeenCalledTimes(1)
      await waitFor(() => expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull())
    } finally { uuid.mockRestore() }
  })

  it('CHECKOUT_CHANGED descarta tentativa e exige preview antes de uma nova key', async () => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    let previews = 0
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => { previews += 1; return success({ ...singlePreview, checkoutFingerprint: (previews === 1 ? 'a' : 'b').repeat(64) }) }))
    const keys = ['70000000-0000-4000-8000-000000000003', '70000000-0000-4000-8000-000000000004'] as const
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValueOnce(keys[0]).mockReturnValueOnce(keys[1])
    const sentKeys: Array<string | null> = []
    server.use(http.post(API_BASE_URL + '/orders', ({ request }) => {
      sentKeys.push(request.headers.get('Idempotency-Key'))
      return sentKeys.length === 1 ? failure(409, 'CHECKOUT_CHANGED') : success(orderDetailsFixture, 201)
    }))
    try {
      mount(); await reviewSingle()
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
      expect(await screen.findByRole('alert')).toHaveTextContent('checkout foi atualizado')
      expect(screen.queryByRole('button', { name: 'Confirmar pedido' })).not.toBeInTheDocument()
      expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
      await userEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
      await screen.findByRole('heading', { name: 'Revisão do pedido' })
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
      expect(await screen.findByRole('heading', { name: 'Detalhe alcançado' })).toBeInTheDocument()
      expect(sentKeys).toEqual(keys)
    } finally { uuid.mockRestore() }
  })

  it.each([
    ['IDEMPOTENCY_KEY_REUSED', 409, 'reutilizar esta tentativa', false],
    ['RATE_LIMITED', 429, 'Muitas tentativas', true],
    ['DEPENDENCY_UNAVAILABLE', 503, 'temporariamente indisponível', true],
  ])('create %s mantém carrinho e apresenta recuperação segura', async (code, status, message, retryable) => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(
      http.post(API_BASE_URL + '/checkout/preview', () => success(singlePreview)),
      http.post(API_BASE_URL + '/orders', () => failure(status as number, code as string)),
    )
    const uuid = vi.spyOn(globalThis.crypto, 'randomUUID').mockReturnValue('70000000-0000-4000-8000-000000000005')
    try {
      mount(); await reviewSingle()
      await userEvent.click(screen.getByRole('button', { name: 'Confirmar pedido' }))
      expect(await screen.findByRole('alert')).toHaveTextContent(message as string)
      expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
      if (retryable) expect(screen.getByRole('button', { name: 'Tentar novamente' })).toBeInTheDocument()
      else expect(screen.queryByRole('heading', { name: 'Revisão do pedido' })).not.toBeInTheDocument()
    } finally { uuid.mockRestore() }
  })
})

describe('CheckoutPage — matriz segura de erros de preview', () => {
  it.each([
    ['PROFILE_REQUIRED', 409, 'Complete os dados'],
    ['RECIPIENT_NOT_FOUND', 404, 'destinatário não está mais disponível'],
    ['VALIDATION_ERROR', 422, 'validar o pedido'],
    ['RATE_LIMITED', 429, 'Muitas tentativas'],
    ['DEPENDENCY_UNAVAILABLE', 503, 'temporariamente indisponível'],
    ['UNAUTHENTICATED', 401, 'sessão não é mais válida'],
    ['FORBIDDEN', 403, 'não tem permissão'],
  ])('%s não expõe backend nem limpa Cart', async (code, status, message) => {
    authenticate(); customerData()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(singleCart))
    server.use(http.post(API_BASE_URL + '/checkout/preview', () => failure(status as number, code as string)))
    mount(); await fillSingle()
    await userEvent.click(screen.getByRole('button', { name: 'Revisar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message as string)
    expect(screen.queryByText('private backend stack')).not.toBeInTheDocument()
    expect(localStorage.getItem(CART_STORAGE_KEY)).not.toBeNull()
  })
})
