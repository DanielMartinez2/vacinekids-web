import { screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { API_BASE_URL } from '../../api/httpClient'
import { ProtectedRoute } from '../../components/auth/ProtectedRoute'
import { CART_STORAGE_KEY } from '../../contexts/CartContext'
import type { CustomerService } from '../../services/customerService'
import { customerProfileFixture, dependentFixture } from '../../test/fixtures'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { LoginPage } from '../Auth/AuthPages'
import { AccountPage } from './AccountPage'

const customer = { id: 'customer-1', email: 'cliente@example.test', role: 'CUSTOMER', status: 'ACTIVE' }
const meta = (page = 1, total = 0, totalPages = 0) => ({ page, pageSize: 20, total, totalPages })
const success = <T,>(data: T) => HttpResponse.json({ data, error: null })
const failure = (status: number, code = 'TEST_ERROR') => HttpResponse.json({ data: null, error: { code, message: 'private SQL details' } }, { status })

function authenticate(role: 'CUSTOMER' | 'ADMIN' = 'CUSTOMER') {
  server.use(http.get(API_BASE_URL + '/auth/me', () => success({ ...customer, role })))
}

function mount(service?: CustomerService) {
  return renderWithProviders(<main><Routes>
    <Route path="/login" element={<LoginPage />} />
    <Route element={<ProtectedRoute />}><Route path="/minha-conta" element={<AccountPage service={service} />} /></Route>
  </Routes></main>, ['/minha-conta'])
}

function profileSection() { return screen.findByRole('region', { name: 'Perfil do responsável' }) }
function dependentsSection() { return screen.findByRole('region', { name: 'Dependentes' }) }

describe('AccountPage — acesso e papéis', () => {
  it('mantém dados de acesso visíveis enquanto profile e dependents carregam em paralelo', async () => {
    authenticate()
    let finishProfile!: () => void
    let finishDependents!: () => void
    const profileGate = new Promise<void>((resolve) => { finishProfile = resolve })
    const dependentsGate = new Promise<void>((resolve) => { finishDependents = resolve })
    server.use(
      http.get(API_BASE_URL + '/profile', async () => { await profileGate; return success(customerProfileFixture) }),
      http.get(API_BASE_URL + '/dependents', async () => { await dependentsGate; return HttpResponse.json({ data: [], meta: meta(), error: null }) }),
    )
    mount()
    expect(await screen.findByText(customer.email)).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.getByText('Carregando perfil...')).toBeInTheDocument()
    expect(screen.getByText('Carregando dependentes...')).toBeInTheDocument()
    finishProfile()
    expect(await screen.findByText(customerProfileFixture.name)).toBeInTheDocument()
    expect(screen.getByText('Carregando dependentes...')).toBeInTheDocument()
    finishDependents()
    expect(await screen.findByText('Nenhum dependente cadastrado.')).toBeInTheDocument()
  })

  it('ADMIN vê somente acesso/logout e não chama o domínio CUSTOMER', async () => {
    authenticate('ADMIN')
    const service: CustomerService = {
      getProfile: vi.fn(), putProfile: vi.fn(), listDependents: vi.fn(), createDependent: vi.fn(),
      getDependent: vi.fn(), updateDependent: vi.fn(), deleteDependent: vi.fn(),
    }
    mount(service)
    expect(await screen.findByText(customer.email)).toBeInTheDocument()
    expect(screen.getByText('Administrador')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.queryByText('Perfil do responsável')).not.toBeInTheDocument()
    expect(screen.queryByText('Dependentes')).not.toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Adicionar dependente' })).not.toBeInTheDocument()
    expect(service.getProfile).not.toHaveBeenCalled()
    expect(service.listDependents).not.toHaveBeenCalled()
  })

  it('401 em dado da conta revalida a sessão e deixa ProtectedRoute redirecionar', async () => {
    let authChecks = 0
    server.use(
      http.get(API_BASE_URL + '/auth/me', () => ++authChecks === 1 ? success(customer) : failure(401, 'UNAUTHENTICATED')),
      http.get(API_BASE_URL + '/profile', () => failure(401, 'UNAUTHENTICATED')),
      http.get(API_BASE_URL + '/dependents', () => HttpResponse.json({ data: [], meta: meta(), error: null })),
    )
    mount()
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(authChecks).toBeGreaterThanOrEqual(2)
  })
})

describe('AccountPage — perfil do responsável', () => {
  it('trata profile null como estado válido, cria com nome normalizado e telefone E.164', async () => {
    authenticate()
    let payload: unknown
    server.use(http.put(API_BASE_URL + '/profile', async ({ request }) => {
      payload = await request.json()
      return success(customerProfileFixture)
    }))
    mount()
    const section = await profileSection()
    expect(await within(section).findByText('Complete seu perfil para cadastrar dependentes.')).toBeInTheDocument()
    expect(within(await dependentsSection()).queryByRole('button', { name: 'Adicionar dependente' })).not.toBeInTheDocument()
    await userEvent.type(within(section).getByLabelText('Nome'), '  Marina   Exemplo  ')
    await userEvent.type(within(section).getByLabelText('Telefone'), '(11) 99999-0001')
    await userEvent.click(within(section).getByRole('button', { name: 'Salvar perfil' }))
    expect(await within(section).findByText('Perfil criado com sucesso.')).toHaveFocus()
    expect(payload).toEqual({ name: 'Marina Exemplo', phone: '+5511999990001' })
    expect(within(section).getByText('(11) 99999-0001')).toBeInTheDocument()
    expect(within(await dependentsSection()).getByRole('button', { name: 'Adicionar dependente' })).toBeInTheDocument()
  })

  it('mostra profile existente, cancela edição e preserva valores após erro de PUT', async () => {
    authenticate()
    server.use(
      http.get(API_BASE_URL + '/profile', () => success(customerProfileFixture)),
      http.put(API_BASE_URL + '/profile', () => failure(503)),
    )
    mount()
    const section = await profileSection()
    expect(await within(section).findByText(customerProfileFixture.name)).toBeInTheDocument()
    expect(within(section).getByText('(11) 99999-0001')).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Editar perfil' }))
    await userEvent.clear(within(section).getByLabelText('Nome'))
    await userEvent.type(within(section).getByLabelText('Nome'), 'Nome temporário')
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar' }))
    expect(within(section).getByText(customerProfileFixture.name)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Editar perfil' }))
    await userEvent.clear(within(section).getByLabelText('Nome'))
    await userEvent.type(within(section).getByLabelText('Nome'), 'Marina Atualizada')
    await userEvent.click(within(section).getByRole('button', { name: 'Salvar perfil' }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('temporariamente indisponível')
    expect(within(section).getByLabelText('Nome')).toHaveValue('Marina Atualizada')
    expect(within(section).getByRole('button', { name: 'Salvar perfil' })).toBeEnabled()
  })

  it('atualiza um profile existente e retorna ao modo leitura', async () => {
    authenticate()
    server.use(
      http.get(API_BASE_URL + '/profile', () => success(customerProfileFixture)),
      http.put(API_BASE_URL + '/profile', async ({ request }) => {
        const body = await request.json() as { name: string; phone: string }
        return success({ ...customerProfileFixture, ...body })
      }),
    )
    mount()
    const section = await profileSection()
    expect(await within(section).findByText(customerProfileFixture.name)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Editar perfil' }))
    await userEvent.clear(within(section).getByLabelText('Nome'))
    await userEvent.type(within(section).getByLabelText('Nome'), 'Marina Atualizada')
    await userEvent.click(within(section).getByRole('button', { name: 'Salvar perfil' }))
    expect(await within(section).findByText('Perfil atualizado com sucesso.')).toHaveFocus()
    expect(within(section).getByText('Marina Atualizada')).toBeInTheDocument()
    expect(within(section).queryByLabelText('Nome')).not.toBeInTheDocument()
  })

  it('permite tentar novamente quando o carregamento do profile falha', async () => {
    authenticate()
    let attempts = 0
    server.use(http.get(API_BASE_URL + '/profile', () => ++attempts === 1 ? failure(503) : success(customerProfileFixture)))
    mount()
    const section = await profileSection()
    expect(await within(section).findByRole('alert')).toHaveTextContent('temporariamente indisponível')
    await userEvent.click(within(section).getByRole('button', { name: /Tentar novamente/ }))
    expect(await within(section).findByText(customerProfileFixture.name)).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})

describe('AccountPage — dependentes', () => {
  it('mostra lista/data civil, cancela inclusão e cria sem conversão para timestamp', async () => {
    authenticate()
    let postPayload: unknown
    server.use(
      http.get(API_BASE_URL + '/profile', () => success(customerProfileFixture)),
      http.get(API_BASE_URL + '/dependents', () => HttpResponse.json({ data: [dependentFixture], meta: meta(1, 1, 1), error: null })),
      http.post(API_BASE_URL + '/dependents', async ({ request }) => {
        postPayload = await request.json()
        return HttpResponse.json({ data: { ...dependentFixture, id: 'dependent-new', name: 'Bia Exemplo', birthDate: '2022-06-03' }, error: null }, { status: 201 })
      }),
    )
    mount()
    const section = await dependentsSection()
    expect(await within(section).findByText(dependentFixture.name)).toBeInTheDocument()
    expect(within(section).getByText('12/05/2021')).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Adicionar dependente' }))
    expect(within(section).getByRole('heading', { name: 'Novo dependente' })).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar' }))
    expect(within(section).queryByRole('heading', { name: 'Novo dependente' })).not.toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Adicionar dependente' }))
    await userEvent.type(within(section).getByLabelText('Nome'), '  Bia   Exemplo ')
    await userEvent.type(within(section).getByLabelText('Data de nascimento'), '2022-06-03')
    await userEvent.click(within(section).getByRole('button', { name: 'Adicionar dependente' }))
    await waitFor(() => expect(postPayload).toEqual({ name: 'Bia Exemplo', birthDate: '2022-06-03' }))
  })

  it('cancela edição e PATCH envia somente o campo alterado', async () => {
    authenticate()
    let patchPayload: unknown
    server.use(
      http.get(API_BASE_URL + '/profile', () => success(customerProfileFixture)),
      http.get(API_BASE_URL + '/dependents', () => HttpResponse.json({ data: [dependentFixture], meta: meta(1, 1, 1), error: null })),
      http.patch(API_BASE_URL + '/dependents/:id', async ({ request }) => {
        patchPayload = await request.json()
        return success({ ...dependentFixture, name: 'Lia Atualizada' })
      }),
    )
    mount()
    const section = await dependentsSection()
    expect(await within(section).findByText(dependentFixture.name)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Editar' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar' }))
    expect(within(section).queryByLabelText('Data de nascimento')).not.toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Editar' }))
    await userEvent.clear(within(section).getByLabelText('Nome'))
    await userEvent.type(within(section).getByLabelText('Nome'), 'Lia Atualizada')
    await userEvent.click(within(section).getByRole('button', { name: 'Salvar alterações' }))
    expect(await within(section).findByText('Lia Atualizada')).toBeInTheDocument()
    expect(patchPayload).toEqual({ name: 'Lia Atualizada' })
  })

  it('cancela remoção; falha mantém card e permite confirmar novamente com sucesso', async () => {
    authenticate()
    let deleteAttempts = 0
    let deleted = false
    server.use(
      http.get(API_BASE_URL + '/profile', () => success(customerProfileFixture)),
      http.get(API_BASE_URL + '/dependents', () => HttpResponse.json({ data: deleted ? [] : [dependentFixture], meta: deleted ? meta() : meta(1, 1, 1), error: null })),
      http.delete(API_BASE_URL + '/dependents/:id', () => {
        deleteAttempts += 1
        if (deleteAttempts === 1) return failure(503)
        deleted = true
        return new HttpResponse(null, { status: 204 })
      }),
    )
    mount()
    const section = await dependentsSection()
    expect(await within(section).findByText(dependentFixture.name)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Remover' }))
    expect(within(section).getByRole('button', { name: 'Confirmar remoção' })).toHaveFocus()
    await userEvent.click(within(section).getByRole('button', { name: 'Cancelar' }))
    expect(within(section).queryByText('Remover este dependente?')).not.toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Remover' }))
    await userEvent.click(within(section).getByRole('button', { name: 'Confirmar remoção' }))
    expect(await within(section).findByRole('alert')).toHaveTextContent('temporariamente indisponível')
    expect(within(section).getByText(dependentFixture.name)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: 'Confirmar remoção' }))
    expect(await within(section).findByText('Nenhum dependente cadastrado.')).toBeInTheDocument()
    expect(deleteAttempts).toBe(2)
  })

  it('pagina em blocos de 20 e o retry recupera erro de listagem', async () => {
    authenticate()
    const pages: number[] = []
    let failFirst = true
    const second = { ...dependentFixture, id: 'dependent-page-2', name: 'Lia Página Dois' }
    server.use(
      http.get(API_BASE_URL + '/profile', () => success(customerProfileFixture)),
      http.get(API_BASE_URL + '/dependents', ({ request }) => {
        const url = new URL(request.url)
        const page = Number(url.searchParams.get('page'))
        expect(url.searchParams.get('pageSize')).toBe('20')
        pages.push(page)
        if (failFirst) { failFirst = false; return failure(503) }
        return HttpResponse.json({ data: [page === 1 ? dependentFixture : second], meta: meta(page, 21, 2), error: null })
      }),
    )
    mount()
    const section = await dependentsSection()
    expect(await within(section).findByRole('alert')).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: /Tentar novamente/ }))
    expect(await within(section).findByText(dependentFixture.name)).toBeInTheDocument()
    await userEvent.click(within(section).getByRole('button', { name: /Próxima/ }))
    expect(await within(section).findByText(second.name)).toBeInTheDocument()
    expect(pages).toEqual([1, 1, 2])
  })

  it('não persiste profile/dependents e mantém o carrinho intacto', async () => {
    authenticate()
    const cart = [{ type: 'vaccine', id: 'vaccine-cart', name: 'Vacina do carrinho', price: 100, quantity: 2 }]
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cart))
    server.use(
      http.get(API_BASE_URL + '/profile', () => success(customerProfileFixture)),
      http.get(API_BASE_URL + '/dependents', () => HttpResponse.json({ data: [dependentFixture], meta: meta(1, 1, 1), error: null })),
    )
    mount()
    expect(await screen.findByText(customerProfileFixture.name)).toBeInTheDocument()
    expect(screen.getByText(dependentFixture.name)).toBeInTheDocument()
    await waitFor(() => expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? 'null')).toEqual(cart))
    expect(localStorage.length).toBe(1)
    expect(sessionStorage.length).toBe(0)
    expect(JSON.stringify(localStorage)).not.toContain(customerProfileFixture.phone)
    expect(JSON.stringify(localStorage)).not.toContain(dependentFixture.birthDate)
  })
})
