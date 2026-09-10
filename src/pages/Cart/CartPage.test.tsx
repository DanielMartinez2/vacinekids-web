import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'
import { CART_STORAGE_KEY } from '../../contexts/CartContext'
import { renderWithProviders } from '../../test/render'
import { CartPage } from './CartPage'

describe('CartPage', () => {
  it('mostra o estado vazio', () => {
    renderWithProviders(<CartPage />)
    expect(screen.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: /Explorar produtos/ })).toBeInTheDocument()
  })

  it('altera quantidade, recalcula subtotal e remove o item', async () => {
    const user = userEvent.setup()
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ type: 'vaccine', id: 'v-1', name: 'Vacina Teste', price: 100, quantity: 1 }]))
    renderWithProviders(<CartPage />)
    expect(screen.getByText('R$ 100,00', { selector: '.cart-line-total' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    expect(screen.getByText('R$ 200,00', { selector: '.cart-line-total' })).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Remover Vacina Teste' }))
    expect(screen.getByRole('heading', { name: 'Seu carrinho está vazio' })).toBeInTheDocument()
  })

  it('oferece checkout natural e mantém Payment fora do escopo', () => {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify([{ type: 'package', id: 'p-1', name: 'Pacote Teste', price: 300, quantity: 1 }]))
    renderWithProviders(<CartPage />)
    expect(screen.getByRole('link', { name: /Finalizar pedido/ })).toHaveAttribute('href', '/checkout')
    expect(screen.getByText(/Pagamentos e agendamentos ainda não/)).toBeInTheDocument()
  })
})
