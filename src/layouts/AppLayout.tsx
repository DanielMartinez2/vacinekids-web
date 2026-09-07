import { Outlet, useLocation } from 'react-router-dom'
import { AuthStatus } from '../components/auth/AuthStatus'
import { useAuth } from '../contexts/AuthContext'
import { Footer } from '../components/layout/Footer'
import { Header } from '../components/layout/Header'

export function AppLayout() {
  const { pathname } = useLocation()
  const { isLoading, error } = useAuth()
  const guarded = ['/minha-conta', '/admin'].includes(pathname)
  return (
    <div className="app-shell">
      <Header />
      <main className="app-main">
        {!guarded && (isLoading || error) && <div className="container auth-status"><AuthStatus /></div>}
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
