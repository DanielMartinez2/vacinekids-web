import { act, renderHook } from '@testing-library/react'
import type { PropsWithChildren } from 'react'
import { describe, expect, it } from 'vitest'
import { CART_STORAGE_KEY, CartProvider, cartReducer, readStoredCart, useCart } from './CartContext'

const vaccine = { type: 'vaccine' as const, id: 'same-id', name: 'Vacina A', price: 100 }
const packageItem = { type: 'package' as const, id: 'same-id', name: 'Pacote A', price: 250 }

describe('CartContext', () => {
  it('adiciona itens e soma quantidades de um mesmo produto', () => {
    const once = cartReducer([], { type: 'add', item: vaccine })
    const twice = cartReducer(once, { type: 'add', item: { ...vaccine, quantity: 2 } })
    expect(twice).toEqual([{ ...vaccine, quantity: 3 }])
  })

  it('distingue vacina e pacote mesmo quando os ids coincidem', () => {
    const state = cartReducer(cartReducer([], { type: 'add', item: vaccine }), { type: 'add', item: packageItem })
    expect(state).toHaveLength(2)
  })

  it('recupera de JSON inválido no localStorage', () => {
    localStorage.setItem(CART_STORAGE_KEY, '{conteudo inválido')
    expect(readStoredCart()).toEqual([])
  })

  it('persiste, altera quantidade e remove o último item', () => {
    const wrapper = ({ children }: PropsWithChildren) => <CartProvider>{children}</CartProvider>
    const { result } = renderHook(() => useCart(), { wrapper })
    act(() => result.current.addItem(vaccine))
    expect(JSON.parse(localStorage.getItem(CART_STORAGE_KEY) ?? '[]')).toHaveLength(1)
    act(() => result.current.setQuantity('vaccine', vaccine.id, 3))
    expect(result.current.itemCount).toBe(3)
    act(() => result.current.removeItem('vaccine', vaccine.id))
    expect(result.current.items).toEqual([])
    expect(localStorage.getItem(CART_STORAGE_KEY)).toBeNull()
  })
})
