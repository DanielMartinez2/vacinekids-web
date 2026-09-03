export function formatCurrency(value: string | number) {
  const numberValue = typeof value === 'string' ? Number.parseFloat(value) : value
  return new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(numberValue)
}
