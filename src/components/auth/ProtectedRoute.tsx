import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { AuthStatus } from './AuthStatus'
export function ProtectedRoute() {
  const { isLoading, error, isAuthenticated } = useAuth()
  const location = useLocation()
  if (isLoading || error) return <section className="container auth-status"><AuthStatus /></section>
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />
  return <Outlet />
}
