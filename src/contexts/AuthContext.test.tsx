import { act, renderHook, waitFor } from '@testing-library/react'
import { type PropsWithChildren } from 'react'
import { MemoryRouter } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import { ApiClientError } from '../api/httpClient'
import type { AuthService } from '../services/authService'
import type { AuthUser } from '../types/auth'
import { CART_STORAGE_KEY, CartProvider, useCart } from './CartContext'
import { AuthProvider, useAuth } from './AuthContext'

const customer: AuthUser = { id: 'customer-1', email: 'cliente@example.test', role: 'CUSTOMER', status: 'ACTIVE' }
const visitor = () => new ApiClientError('Autenticação necessária.', 'http', 401)
const deferred = <T,>() => {
  let resolve!: (value: T) => void
  let reject!: (error: unknown) => void
  const promise = new Promise<T>((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
function setup(overrides: Partial<AuthService> = {}) {
  const service = { me: vi.fn().mockResolvedValue(customer), login: vi.fn().mockResolvedValue(customer),
    register: vi.fn().mockResolvedValue(undefined), logout: vi.fn().mockResolvedValue(undefined), ...overrides }
  const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter><AuthProvider service={service}>{children}</AuthProvider></MemoryRouter>
  return { service, ...renderHook(() => useAuth(), { wrapper }) }
}
describe('AuthProvider', () => {
  it('reconstrói sessão por me 200 sem Web Storage', async () => {
    const { result } = setup()
    expect(result.current.isLoading).toBe(true)
    await waitFor(() => expect(result.current.user).toEqual(customer))
    expect(result.current.isAuthenticated).toBe(true)
    expect(localStorage.length).toBe(0)
    expect(sessionStorage.length).toBe(0)
  })
  it('me 401 é visitante normal sem erro', async () => {
    const { result } = setup({ me: vi.fn().mockRejectedValue(visitor()) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    expect(result.current.user).toBeNull()
    expect(result.current.error).toBeNull()
  })
  it.each(['network', 'http'] as const)('me %s mostra erro recuperável e retry', async (kind) => {
    const me = vi.fn().mockRejectedValueOnce(new ApiClientError('private', kind, kind === 'http' ? 500 : undefined)).mockResolvedValue(customer)
    const { result } = setup({ me })
    await waitFor(() => expect(result.current.error?.operation).toBe('session'))
    await act(async () => { await result.current.retry() })
    expect(result.current.user).toEqual(customer)
    expect(result.current.error).toBeNull()
  })
  it('falha de revalidação preserva usuário confirmado', async () => {
    const me = vi.fn().mockResolvedValueOnce(customer).mockRejectedValue(new Error('offline'))
    const { result } = setup({ me })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.retry() })
    expect(result.current.user).toEqual(customer)
    expect(result.current.error?.operation).toBe('session')
  })
  it('register não autentica automaticamente e login atualiza usuário', async () => {
    const { result, service } = setup({ me: vi.fn().mockRejectedValue(visitor()) })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await result.current.register(customer.email, 'uma frase longa') })
    expect(result.current.user).toBeNull()
    await act(async () => { await result.current.login(customer.email, 'uma frase longa') })
    expect(result.current.user).toEqual(customer)
    expect(service.login).toHaveBeenCalledOnce()
  })
  it('logout só limpa usuário após confirmação do servidor', async () => {
    const pending = deferred<void>()
    const { result } = setup({ logout: () => pending.promise })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    let leaving!: Promise<void>
    act(() => { leaving = result.current.logout() })
    expect(result.current.user).toEqual(customer)
    expect(result.current.isPending).toBe(true)
    await act(async () => { pending.resolve(); await leaving })
    expect(result.current.user).toBeNull()
  })
  it('logout falho preserva usuário e retry repete logout, não me', async () => {
    const logout = vi.fn().mockRejectedValueOnce(new Error('offline')).mockResolvedValue(undefined)
    const { result, service } = setup({ logout })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { await expect(result.current.logout()).rejects.toThrow() })
    expect(result.current.user).toEqual(customer)
    expect(result.current.error?.operation).toBe('logout')
    await act(async () => { await result.current.retry() })
    expect(logout).toHaveBeenCalledTimes(2)
    expect(service.me).toHaveBeenCalledOnce()
    expect(result.current.user).toBeNull()
  })
  it.each(['resolve', 'reject'] as const)('me antigo após logout é ignorado: %s', async (settle) => {
    const old = deferred<AuthUser>()
    const { result } = setup({ me: () => old.promise })
    await act(async () => { await result.current.logout() })
    await act(async () => { if (settle === 'resolve') old.resolve(customer); else old.reject(new Error('old network error')) })
    expect(result.current.user).toBeNull()
    expect(result.current.error).toBeNull()
    expect(result.current.isLoading).toBe(false)
  })
  it('me antigo não desfaz login recente', async () => {
    const old = deferred<AuthUser>()
    const { result } = setup({ me: () => old.promise })
    await act(async () => { await result.current.login(customer.email, 'uma frase longa') })
    await act(async () => { old.reject(visitor()) })
    expect(result.current.user).toEqual(customer)
  })
  it('serializa logout e impede retry me durante mutação', async () => {
    const pending = deferred<void>()
    const { result, service } = setup({ logout: () => pending.promise })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    let leaving!: Promise<void>
    act(() => { leaving = result.current.logout() })
    await act(async () => {
      await expect(result.current.logout()).rejects.toThrow('em andamento')
      expect(await result.current.retry()).toBe(false)
    })
    expect(service.me).toHaveBeenCalledOnce()
    await act(async () => { pending.resolve(); await leaving })
  })
  it('ignora bootstrap antigo no StrictMode', async () => {
    const old = deferred<AuthUser>()
    const service = { me: vi.fn().mockReturnValueOnce(old.promise).mockRejectedValue(visitor()),
      register: vi.fn(), login: vi.fn(), logout: vi.fn() }
    const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter><AuthProvider service={service}>{children}</AuthProvider></MemoryRouter>
    const { result } = renderHook(() => useAuth(), { wrapper, reactStrictMode: true })
    await waitFor(() => expect(result.current.isLoading).toBe(false))
    await act(async () => { old.resolve(customer) })
    expect(result.current.user).toBeNull()
  })
  it('login/logout/reload preservam carrinho sem dados auth', async () => {
    const service = { me: vi.fn().mockRejectedValue(visitor()), login: vi.fn().mockResolvedValue(customer), register: vi.fn(), logout: vi.fn() }
    const wrapper = ({ children }: PropsWithChildren) => <MemoryRouter><CartProvider><AuthProvider service={service}>{children}</AuthProvider></CartProvider></MemoryRouter>
    const rendered = renderHook(() => ({ auth: useAuth(), cart: useCart() }), { wrapper })
    await waitFor(() => expect(rendered.result.current.auth.isLoading).toBe(false))
    act(() => rendered.result.current.cart.addItem({ id: 'v1', type: 'vaccine', name: 'Vacina', price: 10 }))
    const before = localStorage.getItem(CART_STORAGE_KEY)
    await act(async () => { await rendered.result.current.auth.login(customer.email, 'uma frase longa'); await rendered.result.current.auth.logout() })
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBe(before)
    expect(Object.keys(localStorage)).toEqual([CART_STORAGE_KEY])
    expect(before).not.toContain(customer.email)
    rendered.unmount()
    const reloaded = renderHook(() => ({ auth: useAuth(), cart: useCart() }), { wrapper })
    await waitFor(() => expect(reloaded.result.current.auth.isLoading).toBe(false))
    expect(reloaded.result.current.cart.itemCount).toBe(1)
    expect(reloaded.result.current.auth.user).toBeNull()
  })
})
