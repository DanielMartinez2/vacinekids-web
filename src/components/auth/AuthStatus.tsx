import { useAuth } from '../../contexts/AuthContext'
import { ErrorState, LoadingState } from '../common/AsyncStates'
export function AuthStatus() {
  const { isLoading, isPending, error, retry } = useAuth()
  if (isLoading) return <LoadingState label="Carregando sessão..." />
  if (!error) return null
  const onRetry = async () => {
    await retry()
  }
  return <div aria-busy={isPending}>
    <ErrorState message={error.message} onRetry={isPending ? undefined : () => { void onRetry() }} />
  </div>
}
