import { describe, expect, it } from 'vitest'
import type { CartItem } from '../types/cart'
import {
  allRecipientSlotsFilled,
  buildCheckoutItems,
  cartTypeToOrderType,
  decimalToCents,
  formatOrderBirthDate,
  orderStatusLabel,
  priceChanged,
} from './order'

const items: CartItem[] = [
  { type: 'vaccine', id: 'v1', name: 'Vacina', price: 10.1, quantity: 2 },
  { type: 'package', id: 'p1', name: 'Pacote', price: 30, quantity: 1 },
]

describe('order utils', () => {
  it('mapeia tipos e transforma quantity em slots sem enviar dados do carrinho', () => {
    const selections = {
      'vaccine:v1': ['CUSTOMER', 'DEPENDENT:d1'],
      'package:p1': ['CUSTOMER'],
    }
    expect(allRecipientSlotsFilled(items, selections)).toBe(true)
    expect(buildCheckoutItems(items, selections)).toEqual([
      { productType: 'VACCINE', productId: 'v1', recipients: [{ type: 'CUSTOMER' }, { type: 'DEPENDENT', dependentId: 'd1' }] },
      { productType: 'PACKAGE', productId: 'p1', recipients: [{ type: 'CUSTOMER' }] },
    ])
    expect(cartTypeToOrderType('vaccine')).toBe('VACCINE')
    expect(cartTypeToOrderType('package')).toBe('PACKAGE')
  })

  it('permite destinatário repetido e rejeita slots incompletos', () => {
    expect(buildCheckoutItems([items[0]], { 'vaccine:v1': ['DEPENDENT:d1', 'DEPENDENT:d1'] })[0].recipients).toHaveLength(2)
    expect(allRecipientSlotsFilled(items, { 'vaccine:v1': ['CUSTOMER', ''], 'package:p1': ['CUSTOMER'] })).toBe(false)
    expect(() => buildCheckoutItems(items, {})).toThrow('Preencha todos')
  })

  it('compara valores em centavos e formata status/data civil sem timezone', () => {
    expect(decimalToCents('120.00')).toBe(12000n)
    expect(decimalToCents(0.1)).toBe(10n)
    expect(priceChanged(120, '120.00')).toBe(false)
    expect(priceChanged(119.99, '120.00')).toBe(true)
    expect(orderStatusLabel('PENDING_PAYMENT')).toBe('Aguardando pagamento')
    expect(orderStatusLabel('CANCELLED')).toBe('Cancelado')
    expect(formatOrderBirthDate('2021-05-12')).toBe('12/05/2021')
  })
})
