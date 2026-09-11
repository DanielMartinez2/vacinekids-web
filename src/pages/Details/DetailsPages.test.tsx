import { screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Route, Routes } from 'react-router-dom'
import { describe, expect, it } from 'vitest'
import { useCart } from '../../contexts/CartContext'
import { packageFixture, vaccineFixture } from '../../test/fixtures'
import { renderWithProviders } from '../../test/render'
import { PackageDetailsPage } from './PackageDetailsPage'
import { VaccineDetailsPage } from './VaccineDetailsPage'

function CartCount() {
  const { itemCount } = useCart()
  return <output aria-label="itens de teste">{itemCount}</output>
}

describe('páginas de detalhes', () => {
  it('carrega uma vacina, ajusta quantidade e adiciona ao carrinho', async () => {
    const user = userEvent.setup()
    renderWithProviders(<><Routes><Route path="/vacinas/:id" element={<VaccineDetailsPage />} /></Routes><CartCount /></>, [`/vacinas/${vaccineFixture.id}`])
    expect(await screen.findByRole('heading', { name: vaccineFixture.name })).toBeInTheDocument()
    expect(screen.getByText('Laboratório Exemplo')).toBeInTheDocument()
    expect(screen.getByText(/nenhuma cobrança real ocorre/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Aumentar quantidade' }))
    await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }))
    expect(screen.getByLabelText('itens de teste')).toHaveTextContent('2')
    expect(screen.getByText(/2 unidade\(s\) adicionada/)).toBeInTheDocument()
  })

  it('mostra a composição do pacote e permite adicioná-lo', async () => {
    const user = userEvent.setup()
    renderWithProviders(<><Routes><Route path="/pacotes/:id" element={<PackageDetailsPage />} /></Routes><CartCount /></>, [`/pacotes/${packageFixture.id}`])
    expect(await screen.findByRole('heading', { name: packageFixture.name })).toBeInTheDocument()
    expect(screen.getByText(vaccineFixture.name)).toBeInTheDocument()
    expect(screen.getByText('2×')).toBeInTheDocument()
    expect(screen.getByText(/nenhuma cobrança real ocorre/i)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Adicionar ao carrinho' }))
    expect(screen.getByLabelText('itens de teste')).toHaveTextContent('1')
  })
})
