import { Outlet } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { ProtectedRoute } from './ProtectedRoute'

export function CustomerRoute() {
  const { isLoading, error, isAuthenticated, user } = useAuth()
  if (isLoading || error || !isAuthenticated) return <ProtectedRoute />
  if (user?.role !== 'CUSTOMER') return <section className="container page-section">
    <div className="narrow-card"><p>403</p><h1>Acesso não autorizado</h1><p>Esta área é exclusiva de clientes.</p></div>
  </section>
  return <Outlet />
}
