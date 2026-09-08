const e164Pattern = /^\+[1-9][0-9]{7,14}$/
const civilDatePattern = /^(\d{4})-(\d{2})-(\d{2})$/

export function normalizeCustomerName(value: string) {
  return value.normalize('NFC').trim().replace(/\s+/gu, ' ')
}

export function customerNameError(value: string) {
  const normalized = normalizeCustomerName(value)
  const length = [...normalized].length
  if (length < 2) return 'Informe um nome com pelo menos 2 caracteres.'
  if (length > 160) return 'O nome deve ter no máximo 160 caracteres.'
  return null
}

export function normalizePhoneToE164(value: string): string | null {
  const trimmed = value.trim()
  if (!trimmed || !/^\+?[0-9\s().-]+$/.test(trimmed)) return null
  const digits = trimmed.replace(/\D/g, '')
  const canonical = trimmed.startsWith('+')
    ? `+${digits}`
    : digits.length === 10 || digits.length === 11
      ? `+55${digits}`
      : ''
  return e164Pattern.test(canonical) ? canonical : null
}

export function formatPhone(value: string) {
  const match = /^\+55(\d{2})(\d{8,9})$/.exec(value)
  if (!match) return value
  const [, areaCode, number] = match
  const prefixLength = number.length - 4
  return `(${areaCode}) ${number.slice(0, prefixLength)}-${number.slice(prefixLength)}`
}

function isRealCivilDate(value: string) {
  const match = civilDatePattern.exec(value)
  if (!match) return false
  const [, year, month, day] = match
  if (year === '0000') return false
  const date = new Date(`${value}T00:00:00.000Z`)
  return !Number.isNaN(date.getTime()) && date.getUTCFullYear() === Number(year)
    && date.getUTCMonth() + 1 === Number(month) && date.getUTCDate() === Number(day)
}

export function localToday() {
  const now = new Date()
  const year = String(now.getFullYear()).padStart(4, '0')
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  return `${year}-${month}-${day}`
}

export function birthDateError(value: string) {
  if (!isRealCivilDate(value)) return 'Informe uma data de nascimento válida.'
  if (value > localToday()) return 'A data de nascimento não pode estar no futuro.'
  return null
}

export function formatBirthDate(value: string) {
  const match = civilDatePattern.exec(value)
  if (!match || !isRealCivilDate(value)) return value
  const [, year, month, day] = match
  return `${day}/${month}/${year}`
}
