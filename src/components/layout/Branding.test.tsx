import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { http, HttpResponse } from 'msw'
import { API_BASE_URL } from '../../api/httpClient'
import { server } from '../../test/server'
import logo from '../../assets/branding/vacinekids-logo.svg'
import mark from '../../assets/branding/vacinekids-mark.svg'
import { HomePage } from '../../pages/Home/HomePage'
import { renderWithProviders } from '../../test/render'
import { Footer } from './Footer'
import { Header } from './Header'

describe('identidade VacineKids', () => {
  it('usa a logo horizontal e um único nome acessível no link inicial', () => {
    renderWithProviders(<Header />)
    const homeLink = screen.getByRole('link', { name: 'VacineKids — página inicial' })
    expect(homeLink).toHaveAttribute('href', '/')
    expect(homeLink.querySelector('img')).toHaveAttribute('src', logo)
    expect(homeLink.querySelector('img')).toHaveAttribute('alt', '')
    expect(homeLink.querySelector('img')).toHaveAttribute('aria-hidden', 'true')
  })

  it('preserva a abertura e o fechamento do menu ao navegar', async () => {
    const user = userEvent.setup()
    renderWithProviders(<Header />)
    await user.click(screen.getByLabelText('Abrir menu'))
    expect(screen.getByLabelText('Fechar menu')).toHaveAttribute('aria-expanded', 'true')
    await user.click(screen.getByRole('link', { name: 'Produtos' }))
    expect(screen.getByLabelText('Abrir menu')).toHaveAttribute('aria-expanded', 'false')
  })

  it('aplica a marca na Home e o símbolo decorativo no Footer', () => {
    renderWithProviders(<><HomePage /><Footer /></>)
    expect(screen.getByRole('img', { name: 'VacineKids' })).toHaveAttribute('src', logo)
    expect(screen.getByRole('contentinfo').querySelector('img')).toHaveAttribute('src', mark)
    expect(screen.getByText('© 2026 VacineKids. Projeto demonstrativo.')).toBeInTheDocument()
  })

  it('mostra Meus pedidos somente para CUSTOMER autenticado', async () => {
    server.use(http.get(API_BASE_URL + '/auth/me', () => HttpResponse.json({ data: { id: 'u1', email: 'customer@example.test', role: 'CUSTOMER', status: 'ACTIVE' }, error: null })))
    const customer = renderWithProviders(<Header />)
    expect(await screen.findByRole('link', { name: 'Meus pedidos' })).toHaveAttribute('href', '/pedidos')
    customer.unmount()
    server.use(http.get(API_BASE_URL + '/auth/me', () => HttpResponse.json({ data: { id: 'a1', email: 'admin@example.test', role: 'ADMIN', status: 'ACTIVE' }, error: null })))
    renderWithProviders(<Header />)
    expect(await screen.findByRole('link', { name: 'Administração' })).toBeInTheDocument()
    expect(screen.queryByRole('link', { name: 'Meus pedidos' })).not.toBeInTheDocument()
  })
})
