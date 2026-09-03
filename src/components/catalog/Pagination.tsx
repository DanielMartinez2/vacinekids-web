import { ChevronLeft, ChevronRight } from 'lucide-react'

export function Pagination({ page, totalPages, onChange, label }: { page: number; totalPages: number; onChange: (page: number) => void; label: string }) {
  if (totalPages <= 1) return null
  return (
    <nav className="pagination" aria-label={`Paginação de ${label}`}>
      <button type="button" onClick={() => onChange(page - 1)} disabled={page <= 1}><ChevronLeft size={18} aria-hidden="true" /> Anterior</button>
      <span>Página <strong>{page}</strong> de {totalPages}</span>
      <button type="button" onClick={() => onChange(page + 1)} disabled={page >= totalPages}>Próxima <ChevronRight size={18} aria-hidden="true" /></button>
    </nav>
  )
}
