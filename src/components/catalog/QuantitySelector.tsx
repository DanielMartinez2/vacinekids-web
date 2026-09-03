import { Minus, Plus } from 'lucide-react'

export function QuantitySelector({ value, onChange, label = 'Quantidade' }: { value: number; onChange: (value: number) => void; label?: string }) {
  return (
    <div className="quantity-selector">
      <span>{label}</span>
      <div>
        <button type="button" aria-label="Diminuir quantidade" disabled={value <= 1} onClick={() => onChange(value - 1)}><Minus size={16} aria-hidden="true" /></button>
        <output aria-label={`${value} unidade(s)`}>{value}</output>
        <button type="button" aria-label="Aumentar quantidade" onClick={() => onChange(value + 1)}><Plus size={16} aria-hidden="true" /></button>
      </div>
    </div>
  )
}
