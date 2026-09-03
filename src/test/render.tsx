import type { ReactElement } from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { CartProvider } from '../contexts/CartContext'

export function renderWithProviders(ui: ReactElement, initialEntries: string[] = ['/']) {
  return render(<MemoryRouter initialEntries={initialEntries}><CartProvider>{ui}</CartProvider></MemoryRouter>)
}
