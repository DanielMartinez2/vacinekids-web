import type { PaginationMeta } from './api'

export type OrderProductType = 'VACCINE' | 'PACKAGE'
export type OrderRecipientType = 'CUSTOMER' | 'DEPENDENT'
export type OrderStatus = 'PENDING_PAYMENT' | 'PAID' | 'CANCELLED'

export type CheckoutRecipient =
  | { type: 'CUSTOMER' }
  | { type: 'DEPENDENT'; dependentId: string }

export interface CheckoutIntentItem {
  productType: OrderProductType
  productId: string
  recipients: CheckoutRecipient[]
}

export interface CheckoutPreviewRecipient {
  type: OrderRecipientType
  dependentId: string | null
  name: string
  birthDate: string | null
}

export interface CheckoutPreviewComponent {
  vaccineId: string
  name: string
  manufacturer: string
  quantity: number
}

export interface CheckoutPreviewItem {
  productType: OrderProductType
  productId: string
  name: string
  manufacturer: string | null
  unitPrice: string
  quantity: number
  lineTotal: string
  recipients: CheckoutPreviewRecipient[]
  components: CheckoutPreviewComponent[]
}

export interface CheckoutPreview {
  items: CheckoutPreviewItem[]
  currency: 'BRL'
  totalAmount: string
  checkoutFingerprintVersion: 1
  checkoutFingerprint: string
}

export interface OrderItemRecipient extends CheckoutPreviewRecipient {}
export interface OrderItemComponent extends CheckoutPreviewComponent {}
export interface OrderItem extends CheckoutPreviewItem {}

export interface OrderSummary {
  id: string
  number: string
  status: OrderStatus
  currency: 'BRL'
  totalAmount: string
  createdAt: string
  itemCount: number
}

export interface OrderDetails {
  id: string
  number: string
  status: OrderStatus
  currency: 'BRL'
  totalAmount: string
  customer: { name: string; email: string; phone: string }
  createdAt: string
  updatedAt: string
  cancelledAt: string | null
  items: OrderItem[]
}

export interface PaginatedOrders {
  items: OrderSummary[]
  meta: PaginationMeta
}

export interface CreateOrderInput {
  items: CheckoutIntentItem[]
  checkoutFingerprint: string
  checkoutFingerprintVersion: 1
  idempotencyKey: string
}
