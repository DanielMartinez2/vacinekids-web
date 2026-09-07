import { useAuth } from '../../contexts/AuthContext'
export function LogoutButton({ className = 'button button-secondary', onSuccess }: { className?: string; onSuccess?: () => void }) {
  const { logout, isPending, isLoading } = useAuth()
  const leave = async () => {
    try {
      await logout()
      onSuccess?.()
    } catch { /* AuthStatus presents the recoverable server-revocation error. */ }
  }
  return <button type="button" className={className} disabled={isPending || isLoading} onClick={() => { void leave() }}>
    {isPending ? 'Saindo...' : 'Sair'}
  </button>
}
