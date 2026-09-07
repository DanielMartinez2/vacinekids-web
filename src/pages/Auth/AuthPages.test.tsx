import { fireEvent, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { http, HttpResponse } from 'msw'
import { Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { API_BASE_URL } from '../../api/httpClient'
import { ProtectedRoute } from '../../components/auth/ProtectedRoute'
import { AdminRoute } from '../../components/auth/AdminRoute'
import { Header } from '../../components/layout/Header'
import { useAuth } from '../../contexts/AuthContext'
import { AppLayout } from '../../layouts/AppLayout'
import { renderWithProviders } from '../../test/render'
import { server } from '../../test/server'
import { safeLoginDestination, validateAuthForm } from '../../utils/auth'
import { AccountPage, AdminPage, LoginPage, RegisterPage } from './AuthPages'

const customer = { id: 'customer-1', email: 'cliente@example.test', role: 'CUSTOMER', status: 'ACTIVE' }
const fail = (status: number) => HttpResponse.json({ data: null, error: { code: 'INTERNAL', message: 'private SQL details' } }, { status })
function authenticate(role = 'CUSTOMER') {
  server.use(http.get(API_BASE_URL + '/auth/me', () => HttpResponse.json({ data: { ...customer, role }, error: null })))
}
function StateProbe() {
  const { isAuthenticated } = useAuth()
  const location = useLocation()
  return <div data-testid="probe">{JSON.stringify({ isAuthenticated, path: location.pathname, state: location.state })}</div>
}
function mount(path = '/login') {
  return renderWithProviders(<><StateProbe /><Routes><Route element={<AppLayout />}>
    <Route path="/" element={<h1>Home de teste</h1>} />
    <Route path="/login" element={<LoginPage />} />
    <Route path="/cadastro" element={<RegisterPage />} />
    <Route element={<ProtectedRoute />}><Route path="/minha-conta" element={<AccountPage />} /></Route>
    <Route element={<AdminRoute />}><Route path="/admin" element={<AdminPage />} /></Route>
  </Route></Routes></>, [path])
}
async function fill(registration = false, password = 'uma frase longa de senha', confirmation = password) {
  await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
  fireEvent.change(screen.getByLabelText('Email'), { target: { value: customer.email } })
  fireEvent.change(screen.getByLabelText('Senha', { exact: true }), { target: { value: password } })
  if (registration) fireEvent.change(screen.getByLabelText('Confirmar senha'), { target: { value: confirmation } })
}
describe('cadastro', () => {
  it('campos têm labels/autocomplete e envio valida email', async () => {
    mount('/cadastro')
    await waitFor(() => expect(screen.getByLabelText('Email')).toBeEnabled())
    expect(screen.getByLabelText('Email')).toHaveAttribute('autocomplete', 'email')
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveAttribute('autocomplete', 'new-password')
    expect(screen.getByLabelText('Confirmar senha')).toHaveAttribute('autocomplete', 'new-password')
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Informe um email válido.')
    expect(screen.getByRole('alert')).toHaveFocus()
  })
  it.each([['curta', 'curta', '15 a 128'], ['uma frase longa de senha', 'outra frase longa', 'precisam ser iguais']])('rejeita senha/confirm: %s', async (password, confirmation, message) => {
    mount('/cadastro')
    await fill(true, password, confirmation)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(screen.getByRole('alert')).toHaveTextContent(message)
  })
  it('sucesso genérico não autentica, não revela duplicidade e oferece Entrar', async () => {
    server.use(http.post(API_BASE_URL + '/auth/register', () => HttpResponse.json({ data: { message: 'backend generic' }, error: null })))
    mount('/cadastro')
    await fill(true)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByText('Cadastro processado. Agora você pode entrar.')).toBeInTheDocument()
    expect(screen.getByTestId('probe')).toHaveTextContent('"isAuthenticated":false')
    expect(screen.queryByLabelText('Senha', { exact: true })).not.toBeInTheDocument()
    expect(within(screen.getByRole('status')).getByRole('link', { name: 'Entrar' })).toHaveAttribute('href', '/login')
  })
  it('erro preserva formulário e não mostra mensagem interna', async () => {
    server.use(http.post(API_BASE_URL + '/auth/register', () => fail(500)))
    mount('/cadastro')
    await fill(true)
    await userEvent.click(screen.getByRole('button', { name: 'Criar conta' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('A API encontrou um problema.')
    expect(screen.queryByText(/private SQL/)).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Criar conta' })).toBeEnabled()
  })
})
describe('login e logout', () => {
  it('login usa current-password e vai para Minha conta', async () => {
    server.use(http.post(API_BASE_URL + '/auth/login', () => HttpResponse.json({ data: customer, error: null })))
    mount()
    await fill()
    expect(screen.getByLabelText('Senha', { exact: true })).toHaveAttribute('autocomplete', 'current-password')
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Minha conta' })).toBeInTheDocument()
    expect(screen.getByText(customer.email)).toBeInTheDocument()
    expect(screen.getByText('Cliente')).toBeInTheDocument()
  })
  it.each([401, 500])('trata HTTP %s com mensagem segura', async (status) => {
    server.use(http.post(API_BASE_URL + '/auth/login', () => fail(status)))
    mount()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent(status === 401 ? 'Email ou senha inválidos.' : 'A API encontrou um problema.')
    expect(screen.queryByText(/private SQL/)).not.toBeInTheDocument()
  })
  it('erro de rede é recuperável sem limpar formulário', async () => {
    server.use(http.post(API_BASE_URL + '/auth/login', () => HttpResponse.error()))
    mount()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível conectar à API.')
    expect(screen.getByRole('button', { name: 'Entrar' })).toBeEnabled()
  })
  it('retorna ao destino interno original após login', async () => {
    server.use(http.post(API_BASE_URL + '/auth/login', () => HttpResponse.json({ data: { ...customer, role: 'ADMIN' }, error: null })))
    mount('/admin')
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(screen.getByTestId('probe')).toHaveTextContent('"from":"/admin"')
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(await screen.findByRole('heading', { name: 'Área administrativa' })).toBeInTheDocument()
  })
  it('desabilita controles durante envio', async () => {
    let finish!: () => void
    const gate = new Promise<void>((resolve) => { finish = resolve })
    server.use(http.post(API_BASE_URL + '/auth/login', async () => { await gate; return fail(401) }))
    mount()
    await fill()
    await userEvent.click(screen.getByRole('button', { name: 'Entrar' }))
    expect(screen.getByRole('button', { name: 'Enviando...' })).toBeDisabled()
    expect(screen.getByLabelText('Email')).toBeDisabled()
    finish()
    await screen.findByRole('alert')
  })
  it('logout 204 limpa sessão e redireciona para Home', async () => {
    authenticate()
    server.use(http.post(API_BASE_URL + '/auth/logout', () => new HttpResponse(null, { status: 204 })))
    mount('/minha-conta')
    await screen.findByRole('heading', { name: 'Minha conta' })
    await userEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('heading', { name: 'Home de teste' })).toBeInTheDocument()
    expect(screen.getByTestId('probe')).toHaveTextContent('"isAuthenticated":false')
  })
  it('logout falho não anuncia saída; retry revoga e vai para Home', async () => {
    authenticate()
    let attempts = 0
    server.use(http.post(API_BASE_URL + '/auth/logout', () => ++attempts === 1 ? HttpResponse.error() : new HttpResponse(null, { status: 204 })))
    mount('/minha-conta')
    await screen.findByRole('heading', { name: 'Minha conta' })
    await userEvent.click(within(screen.getByRole('main')).getByRole('button', { name: 'Sair' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Sua sessão pode continuar ativa.')
    expect(screen.getByTestId('probe')).toHaveTextContent('"isAuthenticated":true')
    await userEvent.click(screen.getByRole('button', { name: /Tentar novamente/ }))
    expect(await screen.findByRole('heading', { name: 'Home de teste' })).toBeInTheDocument()
    expect(attempts).toBe(2)
  })
})
describe('ProtectedRoute / AdminRoute', () => {
  it('mostra loading sem redirecionamento antecipado', async () => {
    let finish!: () => void
    const gate = new Promise<void>((resolve) => { finish = resolve })
    server.use(http.get(API_BASE_URL + '/auth/me', async () => { await gate; return fail(401) }))
    mount('/minha-conta')
    expect(screen.getByRole('status')).toHaveTextContent('Carregando sessão...')
    expect(screen.getByTestId('probe')).toHaveTextContent('"path":"/minha-conta"')
    finish()
    await screen.findByRole('heading', { name: 'Entrar' })
  })
  it.each(['/minha-conta', '/admin'])('visitante em %s vai para login preservando destino', async (path) => {
    mount(path)
    await screen.findByRole('heading', { name: 'Entrar' })
    expect(screen.getByTestId('probe')).toHaveTextContent('"from":"' + path + '"')
  })
  it('falha de sessão bloqueia conteúdo sem redirecionar para login', async () => {
    server.use(http.get(API_BASE_URL + '/auth/me', () => fail(500)))
    mount('/minha-conta')
    expect(await screen.findByRole('alert')).toHaveTextContent('Não foi possível verificar sua sessão.')
    expect(screen.getByTestId('probe')).toHaveTextContent('"path":"/minha-conta"')
  })
  it('CUSTOMER em admin recebe 403', async () => {
    authenticate()
    mount('/admin')
    expect(await screen.findByRole('heading', { name: 'Acesso não autorizado' })).toBeInTheDocument()
    expect(screen.getByText('403')).toBeInTheDocument()
  })
  it('ADMIN acessa placeholder sem dashboard', async () => {
    authenticate('ADMIN')
    mount('/admin')
    expect(await screen.findByRole('heading', { name: 'Área administrativa' })).toBeInTheDocument()
    expect(screen.getByText('A interface administrativa será implementada em uma fase futura.')).toBeInTheDocument()
  })
})
describe('Header', () => {
  it('visitante vê Entrar/Criar conta e carrinho', async () => {
    renderWithProviders(<Header />)
    expect(await screen.findByRole('link', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Criar conta' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Carrinho/ })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: 'Sair' })).not.toBeInTheDocument()
  })
  it.each(['CUSTOMER', 'ADMIN'])('%s vê os links corretos e menu fecha com Escape', async (role) => {
    authenticate(role)
    renderWithProviders(<Header />)
    await screen.findByRole('link', { name: 'Minha conta' })
    expect(screen.getByRole('button', { name: 'Sair' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Entrar' })).not.toBeInTheDocument()
    expect(!!screen.queryByRole('link', { name: 'Administração' })).toBe(role === 'ADMIN')
    await userEvent.click(screen.getByLabelText('Abrir menu'))
    fireEvent.keyDown(screen.getByRole('navigation', { name: 'Principal' }), { key: 'Escape' })
    expect(screen.getByLabelText('Abrir menu')).toHaveAttribute('aria-expanded', 'false')
    expect(screen.getByLabelText('Abrir menu')).toHaveFocus()
  })
})
describe('validação de credenciais e destino', () => {
  it.each(['/', '/produtos', '/carrinho', '/minha-conta', '/admin'])('permite destino conhecido %s', (from) => {
    expect(safeLoginDestination({ from })).toBe(from)
  })
  it.each(['https://evil.example', '//evil.example', '/%2f%2fevil.example', 'javascript:alert(1)', '/login', '/cadastro', '/unknown', '/admin?next=https://evil.example', 1, null, {}])('bloqueia destino não permitido %s', (from) => {
    expect(safeLoginDestination({ from })).toBe('/minha-conta')
  })
  it('aceita espaços/Unicode/NFC sem composição e conta code points', () => {
    expect(validateAuthForm(' cliente@example.test ', ' '.repeat(15), ' '.repeat(15))).toBeNull()
    expect(validateAuthForm(customer.email, '😀'.repeat(15), '😀'.repeat(15))).toBeNull()
    expect(validateAuthForm(customer.email, 'e\u0301'.repeat(15), 'é'.repeat(15))).toBeNull()
    expect(validateAuthForm(customer.email, 'a'.repeat(128), 'a'.repeat(128))).toBeNull()
    expect(validateAuthForm(customer.email, 'a'.repeat(129), 'a'.repeat(129))).toMatch(/15 a 128/)
    expect(validateAuthForm(customer.email, '😀'.repeat(8), '😀'.repeat(8))).toMatch(/15 a 128/)
  })
})
