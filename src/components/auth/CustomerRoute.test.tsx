import { render, screen } from '@testing-library/react'
import { MemoryRouter, Route, Routes, useLocation } from 'react-router-dom'
import { describe, expect, it, vi } from 'vitest'
import type { AuthService } from '../../services/authService'
import { AuthProvider } from '../../contexts/AuthContext'
import { CustomerRoute } from './CustomerRoute'
import { ApiClientError } from '../../api/httpClient'
import type { AuthUser } from '../../types/auth'

const user = { id: 'u1', email: 'cliente@example.test', role: 'CUSTOMER' as const, status: 'ACTIVE' as const }
const service = (role: 'CUSTOMER' | 'ADMIN'): AuthService => ({
  me: vi.fn().mockResolvedValue({ ...user, role }), login: vi.fn(), register: vi.fn(), logout: vi.fn(),
})

function mount(auth: AuthService) {
  return render(<MemoryRouter initialEntries={['/checkout']}><AuthProvider service={auth}><Routes>
    <Route path="/login" element={<LoginTarget />} />
    <Route element={<CustomerRoute />}><Route path="/checkout" element={<h1>Checkout permitido</h1>} /></Route>
  </Routes></AuthProvider></MemoryRouter>)
}

function LoginTarget() {
  const location = useLocation()
  return <><h1>Entrar</h1><output>{String((location.state as { from?: string } | null)?.from ?? '')}</output></>
}

describe('CustomerRoute', () => {
  it('permite CUSTOMER após reconstruir a sessão', async () => {
    mount(service('CUSTOMER'))
    expect(await screen.findByRole('heading', { name: 'Checkout permitido' })).toBeInTheDocument()
  })

  it('mostra 403 consistente para ADMIN', async () => {
    mount(service('ADMIN'))
    expect(await screen.findByRole('heading', { name: 'Acesso não autorizado' })).toBeInTheDocument()
    expect(screen.queryByText('Checkout permitido')).not.toBeInTheDocument()
  })

  it('preserva o target e envia visitante ao login', async () => {
    const visitor = service('CUSTOMER')
    visitor.me = vi.fn().mockRejectedValue(new ApiClientError('auth', 'http', 401))
    mount(visitor)
    expect(await screen.findByRole('heading', { name: 'Entrar' })).toBeInTheDocument()
    expect(screen.getByText('/checkout')).toBeInTheDocument()
  })

  it('mantém estado acessível enquanto a sessão está sendo reconstruída', () => {
    mount({ ...service('CUSTOMER'), me: vi.fn(() => new Promise<AuthUser>(() => undefined)) })
    expect(screen.getByText('Carregando sessão...')).toBeInTheDocument()
  })
})
