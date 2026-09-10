import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { API_BASE_URL } from '../../api/httpClient'
import { orderDetailsFixture, orderSummaryFixture } from '../../test/fixtures'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { OrderDetailsPage } from './OrderDetailsPage'
import { OrdersPage } from './OrdersPage'

const customer = { id: 'customer-1', email: 'cliente@example.test', role: 'CUSTOMER', status: 'ACTIVE' }
const success = <T,>(data: T, status = 200) => HttpResponse.json({ data, error: null }, { status })
const failure = (status: number, code: string) => HttpResponse.json({ data: null, error: { code, message: 'private SQL data' } }, { status })
function authenticate() { server.use(http.get(API_BASE_URL + '/auth/me', () => success(customer))) }
function mountList() { return renderWithProviders(<Routes><Route path="/pedidos" element={<OrdersPage />} /><Route path="/pedidos/:id" element={<OrderDetailsPage />} /></Routes>, ['/pedidos']) }
function mountDetail(state?: unknown) { return renderWithProviders(<Routes><Route path="/pedidos/:id" element={<OrderDetailsPage />} /></Routes>, [{ pathname: `/pedidos/${orderDetailsFixture.id}`, state } as never]) }

describe('OrdersPage', () => {
  it('mostra loading, cards, labels, BRL e paginação em blocos de 20', async () => {
    authenticate()
    const pages: number[] = []
    server.use(http.get(API_BASE_URL + '/orders', ({ request }) => {
      const page = Number(new URL(request.url).searchParams.get('page'))
      pages.push(page)
      expect(new URL(request.url).searchParams.get('pageSize')).toBe('20')
      return HttpResponse.json({ data: [{ ...orderSummaryFixture, id: page === 1 ? orderSummaryFixture.id : '60000000-0000-4000-8000-000000000002' }], meta: { page, pageSize: 20, total: 21, totalPages: 2 }, error: null })
    }))
    mountList()
    expect(screen.getByText('Carregando pedidos...')).toBeInTheDocument()
    expect(await screen.findByText(orderSummaryFixture.number)).toBeInTheDocument()
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument()
    expect(screen.getByText('R$ 918,80')).toBeInTheDocument()
    await userEvent.click(screen.getByRole('button', { name: /Próxima/ }))
    await waitFor(() => expect(pages).toEqual([1, 2]))
  })

  it('trata lista vazia e recupera 503 com retry manual', async () => {
    authenticate()
    let attempts = 0
    server.use(http.get(API_BASE_URL + '/orders', () => {
      attempts += 1
      return attempts === 1 ? failure(503, 'DEPENDENCY_UNAVAILABLE') : HttpResponse.json({ data: [], meta: { page: 1, pageSize: 20, total: 0, totalPages: 0 }, error: null })
    }))
    mountList()
    expect(await screen.findByRole('alert')).toHaveTextContent('temporariamente indisponível')
    await userEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(await screen.findByText('Nenhum pedido encontrado')).toBeInTheDocument()
    expect(attempts).toBe(2)
  })

  it.each([[403, 'permissão'], [401, 'sessão']])('apresenta erro seguro para HTTP %s', async (status, text) => {
    authenticate()
    server.use(http.get(API_BASE_URL + '/orders', () => failure(status as number, status === 401 ? 'UNAUTHENTICATED' : 'FORBIDDEN')))
    mountList()
    expect(await screen.findByRole('alert')).toHaveTextContent(text as string)
    expect(screen.queryByText('private SQL data')).not.toBeInTheDocument()
  })
})

describe('OrderDetailsPage e cancelamento', () => {
  it('exibe snapshots históricos, Vaccine, Package, components e data civil sem shift', async () => {
    authenticate(); mountDetail({ created: true })
    expect(await screen.findByText('Pedido confirmado com sucesso.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { name: orderDetailsFixture.number })).toBeInTheDocument()
    expect(screen.getByText(orderDetailsFixture.customer.name)).toBeInTheDocument()
    expect(screen.getByText(orderDetailsFixture.customer.email)).toBeInTheDocument()
    expect(screen.getByText('(11) 99999-0001')).toBeInTheDocument()
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument()
    expect(screen.getAllByText('R$ 918,80').length).toBeGreaterThan(0)
    expect(screen.getByText('12/05/2021')).toBeInTheDocument()
    expect(screen.getByText('Vacinas incluídas')).toBeInTheDocument()
    expect(screen.getByText('2 por pacote')).toBeInTheDocument()
    expect(screen.getByText(/dados históricos registrados/)).toBeInTheDocument()
  })

  it('pede confirmação acessível; manter não chama API; confirmar envia {} sem idempotency e atualiza', async () => {
    authenticate()
    let calls = 0
    let body: unknown
    let key: string | null = 'not-captured'
    server.use(http.post(API_BASE_URL + '/orders/:id/cancel', async ({ request }) => {
      calls += 1; body = await request.json(); key = request.headers.get('Idempotency-Key')
      return success({ ...orderDetailsFixture, status: 'CANCELLED', cancelledAt: '2026-09-09T13:00:00.000Z' })
    }))
    mountDetail()
    const section = await screen.findByRole('region', { name: 'Ações do pedido' })
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    expect(within(section).getByText('Tem certeza de que deseja cancelar este pedido?')).toBeInTheDocument()
    expect(within(section).getByRole('button', { name: 'Cancelar pedido' })).toHaveFocus()
    await userEvent.click(within(section).getByRole('button', { name: 'Manter pedido' }))
    expect(calls).toBe(0)
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    expect(await within(section).findByText(/Pedido cancelado em/)).toBeInTheDocument()
    expect(body).toEqual({})
    expect(key).toBeNull()
    expect(calls).toBe(1)
    expect(within(section).queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument()
  })

  it('cancel 503 preserva estado e permite retry; 409 recarrega estado atual', async () => {
    authenticate()
    let calls = 0
    server.use(http.post(API_BASE_URL + '/orders/:id/cancel', () => {
      calls += 1
      return calls === 1 ? failure(503, 'DEPENDENCY_UNAVAILABLE') : failure(409, 'ORDER_NOT_CANCELLABLE')
    }))
    mountDetail()
    const section = await screen.findByRole('region', { name: 'Ações do pedido' })
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('temporariamente indisponível')
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    await waitFor(() => expect(calls).toBe(2))
    expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument()
  })

  it.each([
    ['404', () => failure(404, 'ORDER_NOT_FOUND'), 'Pedido não encontrado'],
    ['network', () => HttpResponse.error(), 'conectar à API'],
  ])('cancel %s mostra estado seguro', async (kind, response, message) => {
    authenticate()
    server.use(http.post(API_BASE_URL + '/orders/:id/cancel', response))
    mountDetail()
    const section = await screen.findByRole('region', { name: 'Ações do pedido' })
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar pedido' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(message as string)
    if (kind === 'network') expect(screen.getByText('Aguardando pagamento')).toBeInTheDocument()
  })

  it.each([[404, 'Pedido não encontrado'], [503, 'temporariamente indisponível']])('trata detalhe HTTP %s sem dados privados', async (status, message) => {
    authenticate()
    server.use(http.get(API_BASE_URL + '/orders/:id', () => failure(status as number, status === 404 ? 'ORDER_NOT_FOUND' : 'DEPENDENCY_UNAVAILABLE')))
    mountDetail()
    expect(await screen.findByRole('alert')).toHaveTextContent(message as string)
    expect(screen.queryByText('private SQL data')).not.toBeInTheDocument()
  })

  it('pedido CANCELLED mostra cancelledAt e não oferece nova ação', async () => {
    authenticate()
    server.use(http.get(API_BASE_URL + '/orders/:id', () => success({ ...orderDetailsFixture, status: 'CANCELLED', cancelledAt: '2026-09-09T13:00:00.000Z' })))
    mountDetail()
    const section = await screen.findByRole('region', { name: 'Ações do pedido' })
    expect(await within(section).findByText(/Pedido cancelado em/)).toBeInTheDocument()
    expect(within(section).queryByRole('button', { name: 'Cancelar pedido' })).not.toBeInTheDocument()
  })
})
