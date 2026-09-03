export type CartItemType = 'vaccine' | 'package'

export interface CartItem {
  type: CartItemType
  id: string
  name: string
  price: number
  quantity: number
}

export type AddCartItem = Omit<CartItem, 'quantity'> & { quantity?: number }
