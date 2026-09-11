import { ApiClientError, apiRequest } from '../api/httpClient'
import type { PaginationMeta } from '../types/api'
import type {
  CheckoutIntentItem,
  CheckoutPreview,
  CheckoutPreviewComponent,
  CheckoutPreviewItem,
  CheckoutPreviewRecipient,
  CreateOrderInput,
  OrderDetails,
  OrderItem,
  OrderStatus,
  OrderSummary,
  PaginatedOrders,
} from '../types/order'

const ORDER_TIMEOUT_MS = 15_000
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MONEY = /^(0|[1-9]\d*)\.\d{2}$/
const FINGERPRINT = /^[0-9a-f]{64}$/
const DATE = /^\d{4}-\d{2}-\d{2}$/
const ORDER_NUMBER = /^VK-[0-9A-F]{20}$/

const invalidResponse = () => new ApiClientError('A API retornou uma resposta inválida.', 'invalid-response')
const record = (value: unknown) => {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw invalidResponse()
  return value as Record<string, unknown>
}
const string = (value: unknown) => {
  if (typeof value !== 'string' || value.length === 0) throw invalidResponse()
  return value
}
const uuid = (value: unknown) => {
  const parsed = string(value)
  if (!UUID.test(parsed)) throw invalidResponse()
  return parsed
}
const money = (value: unknown) => {
  const parsed = string(value)
  if (!MONEY.test(parsed)) throw invalidResponse()
  return parsed
}
const dateTime = (value: unknown) => {
  const parsed = string(value)
  if (Number.isNaN(Date.parse(parsed))) throw invalidResponse()
  return parsed
}
const status = (value: unknown): OrderStatus => {
  if (value !== 'PENDING_PAYMENT' && value !== 'PAID' && value !== 'CANCELLED') throw invalidResponse()
  return value
}
const currency = (value: unknown): 'BRL' => {
  if (value !== 'BRL') throw invalidResponse()
  return value
}
const positiveInteger = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 1) throw invalidResponse()
  return value
}
const nonNegativeInteger = (value: unknown) => {
  if (typeof value !== 'number' || !Number.isInteger(value) || value < 0) throw invalidResponse()
  return value
}

function recipientFrom(value: unknown): CheckoutPreviewRecipient {
  const item = record(value)
  const type = item.type === 'CUSTOMER' || item.type === 'DEPENDENT' ? item.type : null
  if (!type) throw invalidResponse()
  const dependentId = item.dependentId === null ? null : uuid(item.dependentId)
  const birthDate = item.birthDate === null ? null : string(item.birthDate)
  if (birthDate !== null && !DATE.test(birthDate)) throw invalidResponse()
  if (type === 'CUSTOMER' && (dependentId !== null || birthDate !== null)) throw invalidResponse()
  if (type === 'DEPENDENT' && (dependentId === null || birthDate === null)) throw invalidResponse()
  return { type, dependentId, name: string(item.name), birthDate }
}

function componentFrom(value: unknown): CheckoutPreviewComponent {
  const item = record(value)
  return {
    vaccineId: uuid(item.vaccineId),
    name: string(item.name),
    manufacturer: string(item.manufacturer),
    quantity: positiveInteger(item.quantity),
  }
}

function itemFrom(value: unknown): CheckoutPreviewItem {
  const item = record(value)
  const productType = item.productType === 'VACCINE' || item.productType === 'PACKAGE' ? item.productType : null
  if (!productType || !Array.isArray(item.recipients) || !Array.isArray(item.components)) throw invalidResponse()
  const manufacturer = item.manufacturer === null ? null : string(item.manufacturer)
  if ((productType === 'VACCINE' && manufacturer === null) || (productType === 'PACKAGE' && manufacturer !== null)) throw invalidResponse()
  const recipients = item.recipients.map(recipientFrom)
  const components = item.components.map(componentFrom)
  const quantity = positiveInteger(item.quantity)
  if (recipients.length !== quantity || (productType === 'VACCINE' && components.length !== 0) || (productType === 'PACKAGE' && components.length === 0)) throw invalidResponse()
  return {
    productType,
    productId: uuid(item.productId),
    name: string(item.name),
    manufacturer,
    unitPrice: money(item.unitPrice),
    quantity,
    lineTotal: money(item.lineTotal),
    recipients,
    components,
  }
}

function previewFrom(value: unknown): CheckoutPreview {
  const preview = record(value)
  if (!Array.isArray(preview.items) || preview.items.length === 0 || preview.checkoutFingerprintVersion !== 1
    || typeof preview.checkoutFingerprint !== 'string' || !FINGERPRINT.test(preview.checkoutFingerprint)) throw invalidResponse()
  return {
    items: preview.items.map(itemFrom),
    currency: currency(preview.currency),
    totalAmount: money(preview.totalAmount),
    checkoutFingerprintVersion: 1,
    checkoutFingerprint: preview.checkoutFingerprint,
  }
}

function summaryFrom(value: unknown): OrderSummary {
  const order = record(value)
  if (typeof order.number !== 'string' || !ORDER_NUMBER.test(order.number)) throw invalidResponse()
  return {
    id: uuid(order.id),
    number: order.number,
    status: status(order.status),
    currency: currency(order.currency),
    totalAmount: money(order.totalAmount),
    createdAt: dateTime(order.createdAt),
    itemCount: nonNegativeInteger(order.itemCount),
  }
}

function orderFrom(value: unknown): OrderDetails {
  const order = record(value)
  const customer = record(order.customer)
  if (typeof order.number !== 'string' || !ORDER_NUMBER.test(order.number) || !Array.isArray(order.items)) throw invalidResponse()
  const cancelledAt = order.cancelledAt === null ? null : dateTime(order.cancelledAt)
  const parsedStatus = status(order.status)
  if ((parsedStatus !== 'CANCELLED' && cancelledAt !== null) || (parsedStatus === 'CANCELLED' && cancelledAt === null)) throw invalidResponse()
  return {
    id: uuid(order.id),
    number: order.number,
    status: parsedStatus,
    currency: currency(order.currency),
    totalAmount: money(order.totalAmount),
    customer: { name: string(customer.name), email: string(customer.email), phone: string(customer.phone) },
    createdAt: dateTime(order.createdAt),
    updatedAt: dateTime(order.updatedAt),
    cancelledAt,
    items: order.items.map(itemFrom) as OrderItem[],
  }
}

function paginationFrom(value: unknown): PaginationMeta {
  const meta = record(value)
  const page = positiveInteger(meta.page)
  const pageSize = positiveInteger(meta.pageSize)
  const total = nonNegativeInteger(meta.total)
  const totalPages = nonNegativeInteger(meta.totalPages)
  if (totalPages !== Math.ceil(total / pageSize)) throw invalidResponse()
  return { page, pageSize, total, totalPages }
}

const responseData = (response: { data: unknown } | undefined) => {
  if (!response) throw invalidResponse()
  return response.data
}

export const orderService = {
  async previewCheckout(items: CheckoutIntentItem[]): Promise<CheckoutPreview> {
    return previewFrom(responseData(await apiRequest<unknown>('/checkout/preview', {
      method: 'POST', authenticated: true, body: { items }, timeoutMs: ORDER_TIMEOUT_MS,
    })))
  },

  async createOrder({ idempotencyKey, ...body }: CreateOrderInput): Promise<OrderDetails> {
    return orderFrom(responseData(await apiRequest<unknown>('/orders', {
      method: 'POST', authenticated: true, body, idempotencyKey, timeoutMs: ORDER_TIMEOUT_MS,
    })))
  },

  async listOrders({ page = 1, pageSize = 20 } = {}): Promise<PaginatedOrders> {
    const query = new URLSearchParams({ page: String(page), pageSize: String(pageSize) })
    const response = await apiRequest<unknown>(`/orders?${query}`, { authenticated: true })
    const data = responseData(response)
    if (!Array.isArray(data) || !response?.meta) throw invalidResponse()
    return { items: data.map(summaryFrom), meta: paginationFrom(response.meta) }
  },

  async getOrder(id: string): Promise<OrderDetails> {
    return orderFrom(responseData(await apiRequest<unknown>(`/orders/${encodeURIComponent(id)}`, { authenticated: true })))
  },

  async cancelOrder(id: string): Promise<OrderDetails> {
    return orderFrom(responseData(await apiRequest<unknown>(`/orders/${encodeURIComponent(id)}/cancel`, {
      method: 'POST', authenticated: true, body: {}, timeoutMs: ORDER_TIMEOUT_MS,
    })))
  },
}

export type OrderService = typeof orderService
