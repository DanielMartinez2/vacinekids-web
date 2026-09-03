/* oxlint-disable react/only-export-components -- context hook and reducer are intentional public API */
import {
  createContext,
  type PropsWithChildren,
  useContext,
  useEffect,
  useMemo,
  useReducer,
} from 'react'
import type { AddCartItem, CartItem } from '../types/cart'

export const CART_STORAGE_KEY = 'vacinekids-cart-v1'

type CartAction =
  | { type: 'add'; item: AddCartItem }
  | { type: 'remove'; itemType: CartItem['type']; id: string }
  | { type: 'setQuantity'; itemType: CartItem['type']; id: string; quantity: number }
  | { type: 'clear' }

interface CartContextValue {
  items: CartItem[]
  itemCount: number
  subtotal: number
  addItem: (item: AddCartItem) => void
  removeItem: (type: CartItem['type'], id: string) => void
  setQuantity: (type: CartItem['type'], id: string, quantity: number) => void
  clearCart: () => void
}

const CartContext = createContext<CartContextValue | undefined>(undefined)

function isCartItem(value: unknown): value is CartItem {
  if (!value || typeof value !== 'object') return false
  const item = value as Record<string, unknown>

  return (
    (item.type === 'vaccine' || item.type === 'package') &&
    typeof item.id === 'string' &&
    item.id.length > 0 &&
    typeof item.name === 'string' &&
    item.name.length > 0 &&
    typeof item.price === 'number' &&
    Number.isFinite(item.price) &&
    item.price >= 0 &&
    typeof item.quantity === 'number' &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0
  )
}

export function readStoredCart(): CartItem[] {
  try {
    const storedValue = localStorage.getItem(CART_STORAGE_KEY)
    if (!storedValue) return []

    const parsedValue: unknown = JSON.parse(storedValue)
    return Array.isArray(parsedValue) && parsedValue.every(isCartItem) ? parsedValue : []
  } catch {
    return []
  }
}

export function cartReducer(state: CartItem[], action: CartAction): CartItem[] {
  switch (action.type) {
    case 'add': {
      const quantity = Math.max(1, Math.floor(action.item.quantity ?? 1))
      const existingIndex = state.findIndex(
        (item) => item.type === action.item.type && item.id === action.item.id,
      )

      if (existingIndex === -1) return [...state, { ...action.item, quantity }]

      return state.map((item, index) =>
        index === existingIndex ? { ...item, quantity: item.quantity + quantity } : item,
      )
    }
    case 'remove':
      return state.filter(
        (item) => !(item.type === action.itemType && item.id === action.id),
      )
    case 'setQuantity':
      if (!Number.isInteger(action.quantity) || action.quantity < 1) return state
      return state.map((item) =>
        item.type === action.itemType && item.id === action.id
          ? { ...item, quantity: action.quantity }
          : item,
      )
    case 'clear':
      return []
  }
}

export function CartProvider({ children }: PropsWithChildren) {
  const [items, dispatch] = useReducer(cartReducer, undefined, readStoredCart)

  useEffect(() => {
    if (items.length === 0) localStorage.removeItem(CART_STORAGE_KEY)
    else localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items))
  }, [items])

  const value = useMemo<CartContextValue>(
    () => ({
      items,
      itemCount: items.reduce((sum, item) => sum + item.quantity, 0),
      subtotal: items.reduce((sum, item) => sum + item.price * item.quantity, 0),
      addItem: (item) => dispatch({ type: 'add', item }),
      removeItem: (type, id) => dispatch({ type: 'remove', itemType: type, id }),
      setQuantity: (type, id, quantity) =>
        dispatch({ type: 'setQuantity', itemType: type, id, quantity }),
      clearCart: () => dispatch({ type: 'clear' }),
    }),
    [items],
  )

  return <CartContext.Provider value={value}>{children}</CartContext.Provider>
}

export function useCart() {
  const context = useContext(CartContext)
  if (!context) throw new Error('useCart deve ser usado dentro de CartProvider')
  return context
}
