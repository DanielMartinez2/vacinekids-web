import type { CartItem, CartItemType } from '../types/cart'
import type { CheckoutIntentItem, CheckoutRecipient, OrderProductType, OrderStatus } from '../types/order'
import { formatBirthDate } from './customer'
import { ApiClientError } from '../api/httpClient'

export type RecipientSelections = Record<string, string[]>

export const cartItemKey = (item: Pick<CartItem, 'type' | 'id'>) => `${item.type}:${item.id}`

export const cartTypeToOrderType = (type: CartItemType): OrderProductType =>
  type === 'vaccine' ? 'VACCINE' : 'PACKAGE'

export const recipientSelection = (value: string): CheckoutRecipient | null => {
  if (value === 'CUSTOMER') return { type: 'CUSTOMER' }
  if (value.startsWith('DEPENDENT:') && value.length > 'DEPENDENT:'.length) {
    return { type: 'DEPENDENT', dependentId: value.slice('DEPENDENT:'.length) }
  }
  return null
}

export const allRecipientSlotsFilled = (items: CartItem[], selections: RecipientSelections) =>
  items.length > 0 && items.every((item) => {
    const slots = selections[cartItemKey(item)] ?? []
    return slots.length === item.quantity && slots.every((value) => recipientSelection(value) !== null)
  })

export function buildCheckoutItems(items: CartItem[], selections: RecipientSelections): CheckoutIntentItem[] {
  if (!allRecipientSlotsFilled(items, selections)) throw new Error('Preencha todos os destinatários.')
  return items.map((item) => ({
    productType: cartTypeToOrderType(item.type),
    productId: item.id,
    recipients: (selections[cartItemKey(item)] ?? []).map((value) => recipientSelection(value)!),
  }))
}

export const checkoutStateSignature = (items: CartItem[], selections: RecipientSelections) => JSON.stringify(
  items.map((item) => ({
    type: item.type,
    id: item.id,
    name: item.name,
    price: item.price,
    quantity: item.quantity,
    recipients: selections[cartItemKey(item)] ?? [],
  })),
)

export function decimalToCents(value: string | number): bigint | null {
  const normalized = typeof value === 'number' ? value.toFixed(2) : value
  const match = /^(0|[1-9]\d*)\.(\d{2})$/.exec(normalized)
  if (!match) return null
  return BigInt(match[1]) * 100n + BigInt(match[2])
}

export const priceChanged = (cartPrice: number, authoritativePrice: string) => {
  const cart = decimalToCents(cartPrice)
  const current = decimalToCents(authoritativePrice)
  return cart !== null && current !== null && cart !== current
}

export const formatOrderMoney = (value: string) => new Intl.NumberFormat('pt-BR', {
  style: 'currency', currency: 'BRL', minimumFractionDigits: 2, maximumFractionDigits: 2,
}).format(Number.parseFloat(value))

export const orderStatusLabel = (status: OrderStatus) => ({
  PENDING_PAYMENT: 'Aguardando pagamento',
  PAID: 'Pago',
  CANCELLED: 'Cancelado',
})[status]

export const formatOrderDate = (value: string) => new Intl.DateTimeFormat('pt-BR', {
  dateStyle: 'short', timeStyle: 'short',
}).format(new Date(value))

export const formatOrderBirthDate = formatBirthDate

export function ordersError(failure: unknown) {
  if (!(failure instanceof ApiClientError)) return 'Não foi possível carregar os pedidos. Tente novamente.'
  if (failure.kind === 'network' || failure.kind === 'timeout') return failure.message
  if (failure.status === 401) return 'Sua sessão não é mais válida. Estamos verificando seu acesso.'
  if (failure.status === 403) return 'Sua conta não tem permissão para acessar pedidos.'
  if (failure.status === 404) return 'Pedido não encontrado.'
  if (failure.status === 429) return 'Muitas tentativas. Aguarde um pouco e tente novamente.'
  if (failure.status === 503) return 'O serviço está temporariamente indisponível. Tente novamente em instantes.'
  return 'Não foi possível carregar os pedidos. Tente novamente.'
}
