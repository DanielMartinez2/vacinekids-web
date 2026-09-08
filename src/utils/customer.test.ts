import { describe, expect, it } from 'vitest'
import {
  birthDateError,
  customerNameError,
  formatBirthDate,
  formatPhone,
  normalizeCustomerName,
  normalizePhoneToE164,
} from './customer'

describe('customer helpers', () => {
  it('normaliza nomes Unicode, NFC, trim e espaços sem restringir caracteres reais', () => {
    expect(normalizeCustomerName("  Maria   Jose\u0301\tD'Ávila-Santos ")).toBe("Maria José D'Ávila-Santos")
    expect(customerNameError('李 小龍')).toBeNull()
    expect(customerNameError('A')).toMatch(/2 caracteres/)
    expect(customerNameError('á'.repeat(161))).toMatch(/160/)
  })

  it.each([
    ['(11) 99999-0001', '+5511999990001'],
    ['11 99999-0001', '+5511999990001'],
    ['+55 11 99999-0001', '+5511999990001'],
    ['+5511999990001', '+5511999990001'],
  ])('converte telefone amigável %s para E.164', (input, expected) => {
    expect(normalizePhoneToE164(input)).toBe(expected)
  })

  it.each(['', '9999-0001', '+55 abc', '5511999990001', '+0511999990001'])('rejeita telefone inválido %s', (input) => {
    expect(normalizePhoneToE164(input)).toBeNull()
  })

  it('formata telefone brasileiro e preserva outros E.164', () => {
    expect(formatPhone('+5511999990001')).toBe('(11) 99999-0001')
    expect(formatPhone('+551133330001')).toBe('(11) 3333-0001')
    expect(formatPhone('+14155552671')).toBe('+14155552671')
  })

  it('formata data civil sem construir Date em timezone local', () => {
    expect(formatBirthDate('2021-05-12')).toBe('12/05/2021')
    expect(formatBirthDate('invalid')).toBe('invalid')
    expect(birthDateError('2021-02-29')).toMatch(/válida/)
    expect(birthDateError('2999-01-01')).toMatch(/futuro/)
  })
})
