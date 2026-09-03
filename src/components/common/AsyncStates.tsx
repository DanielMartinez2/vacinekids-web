import { AlertCircle, Inbox, LoaderCircle, RefreshCw } from 'lucide-react'

export function LoadingState({ label = 'Carregando informações...' }: { label?: string }) {
  return <div className="state-card" role="status"><LoaderCircle className="spin" aria-hidden="true" /><p>{label}</p></div>
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="state-card state-error" role="alert">
      <AlertCircle aria-hidden="true" />
      <div><strong>Não foi possível carregar.</strong><p>{message}</p></div>
      {onRetry && <button className="button button-secondary" type="button" onClick={onRetry}><RefreshCw size={17} aria-hidden="true" /> Tentar novamente</button>}
    </div>
  )
}

export function EmptyState({ title = 'Nenhum resultado encontrado', message }: { title?: string; message: string }) {
  return <div className="state-card"><Inbox aria-hidden="true" /><div><strong>{title}</strong><p>{message}</p></div></div>
}
