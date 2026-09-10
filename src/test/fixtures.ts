import type { AgeRange, Vaccine, VaccinePackage } from '../types/catalog'
import type { CustomerProfile, Dependent } from '../types/customer'
import type { CheckoutPreview, OrderDetails, OrderSummary } from '../types/order'

export const customerProfileFixture: CustomerProfile = {
  id: '40000000-0000-4000-8000-000000000001',
  name: 'Marina Exemplo',
  phone: '+5511999990001',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const dependentFixture: Dependent = {
  id: '50000000-0000-4000-8000-000000000001',
  name: 'Lia Exemplo',
  birthDate: '2021-05-12',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
}

export const babyRange: AgeRange = { id: '10000000-0000-4000-8000-000000000001', slug: 'bebes', name: 'Bebês', minAgeMonths: 0, maxAgeMonths: 24, sortOrder: 1 }
export const childRange: AgeRange = { id: '10000000-0000-4000-8000-000000000002', slug: 'crianca', name: 'Criança', minAgeMonths: 25, maxAgeMonths: 144, sortOrder: 2 }

export const vaccineFixture: Vaccine = {
  id: '20000000-0000-4000-8000-000000000001', name: 'Vacina Hexavalente', description: 'Proteção combinada para os primeiros meses de vida.', manufacturer: 'Laboratório Exemplo', price: '249.90', ageRanges: [babyRange], faqs: [{ id: 'faq-1', question: 'Precisa de avaliação?', answer: 'Sim, consulte um profissional de saúde.' }], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
}

export const childVaccineFixture: Vaccine = {
  ...vaccineFixture, id: '20000000-0000-4000-8000-000000000002', name: 'Vacina Infantil', price: '139.50', ageRanges: [childRange],
}

export const packageFixture: VaccinePackage = {
  id: '30000000-0000-4000-8000-000000000001', name: 'Pacote Primeiros Cuidados', description: 'Seleção de vacinas para bebês.', price: '399.00', vaccines: [{ quantity: 2, vaccine: vaccineFixture }], faqs: [{ id: 'faq-p', question: 'O que está incluído?', answer: 'As vacinas listadas na composição.' }], createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', deletedAt: null,
}

export const checkoutPreviewFixture: CheckoutPreview = {
  items: [{
    productType: 'VACCINE',
    productId: vaccineFixture.id,
    name: vaccineFixture.name,
    manufacturer: vaccineFixture.manufacturer,
    unitPrice: '259.90',
    quantity: 2,
    lineTotal: '519.80',
    recipients: [
      { type: 'CUSTOMER', dependentId: null, name: customerProfileFixture.name, birthDate: null },
      { type: 'DEPENDENT', dependentId: dependentFixture.id, name: dependentFixture.name, birthDate: dependentFixture.birthDate },
    ],
    components: [],
  }, {
    productType: 'PACKAGE',
    productId: packageFixture.id,
    name: packageFixture.name,
    manufacturer: null,
    unitPrice: packageFixture.price,
    quantity: 1,
    lineTotal: packageFixture.price,
    recipients: [{ type: 'CUSTOMER', dependentId: null, name: customerProfileFixture.name, birthDate: null }],
    components: [{ vaccineId: vaccineFixture.id, name: vaccineFixture.name, manufacturer: vaccineFixture.manufacturer, quantity: 2 }],
  }],
  currency: 'BRL',
  totalAmount: '918.80',
  checkoutFingerprintVersion: 1,
  checkoutFingerprint: 'a'.repeat(64),
}

export const orderDetailsFixture: OrderDetails = {
  id: '60000000-0000-4000-8000-000000000001',
  number: 'VK-7A2F91C4D6E8B1035A9C',
  status: 'PENDING_PAYMENT',
  currency: 'BRL',
  totalAmount: checkoutPreviewFixture.totalAmount,
  customer: { name: customerProfileFixture.name, email: 'cliente@example.test', phone: customerProfileFixture.phone },
  createdAt: '2026-09-09T12:30:00.000Z',
  updatedAt: '2026-09-09T12:30:00.000Z',
  cancelledAt: null,
  items: checkoutPreviewFixture.items,
}

export const orderSummaryFixture: OrderSummary = {
  id: orderDetailsFixture.id,
  number: orderDetailsFixture.number,
  status: orderDetailsFixture.status,
  currency: orderDetailsFixture.currency,
  totalAmount: orderDetailsFixture.totalAmount,
  createdAt: orderDetailsFixture.createdAt,
  itemCount: orderDetailsFixture.items.length,
}
