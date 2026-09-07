/* oxlint-disable react/only-export-components -- provider and hook are the context public API */
import { createContext, startTransition, useCallback, useContext, useEffect, useRef, useState, type PropsWithChildren } from 'react'
import { ApiClientError } from '../api/httpClient'
import { authService, type AuthService } from '../services/authService'
import type { AuthUser } from '../types/auth'
import { useNavigate } from 'react-router-dom'
interface SessionError { operation: 'session' | 'logout'; message: string }
interface AuthContextValue {
  user: AuthUser | null
  isAuthenticated: boolean
  isLoading: boolean
  isPending: boolean
  error: SessionError | null
  register: AuthService['register']
  login: AuthService['login']
  logout: AuthService['logout']
  retry: () => Promise<boolean>
}
const AuthContext = createContext<AuthContextValue | undefined>(undefined)
export function AuthProvider({ children, service = authService }: PropsWithChildren<{ service?: AuthService }>) {
  const navigate = useNavigate()
  const [user, setUser] = useState<AuthUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isPending, setIsPending] = useState(false)
  const [error, setError] = useState<SessionError | null>(null)
  const generation = useRef(0)
  const mutation = useRef(false)
  const refresh = useCallback(async () => {
    if (mutation.current) return false
    const version = ++generation.current
    setIsLoading(true)
    setError(null)
    try {
      const result = await service.me()
      if (version !== generation.current) return false
      setUser(result)
      return true
    } catch (failure) {
      if (version !== generation.current) return false
      if (failure instanceof ApiClientError && failure.kind === 'http' && failure.status === 401) {
        setUser(null)
        return true
      }
      // Uncertainty is not logout: preserve any previously confirmed user.
      setError({ operation: 'session', message: 'Não foi possível verificar sua sessão. Verifique a conexão e tente novamente.' })
      return false
    } finally { if (version === generation.current) setIsLoading(false) }
  }, [service])
  useEffect(() => {
    // oxlint-disable-next-line react/set-state-in-effect -- synchronize with the remote HttpOnly session on mount
    void refresh()
    return () => { generation.current += 1 }
  }, [refresh])
  const beginMutation = () => {
    if (mutation.current) throw new Error('Uma solicitação já está em andamento.')
    mutation.current = true
    const version = ++generation.current
    setIsPending(true)
    setIsLoading(false)
    setError(null)
    return version
  }
  const finishMutation = (version: number) => {
    mutation.current = false
    if (version === generation.current) setIsPending(false)
  }
  const register: AuthService['register'] = async (email, password) => {
    // Registration never establishes a session or changes the current user.
    await service.register(email, password)
  }
  const login: AuthService['login'] = async (email, password) => {
    const version = beginMutation()
    try {
      const result = await service.login(email, password)
      if (version === generation.current) setUser(result)
      return result
    } finally { finishMutation(version) }
  }
  const logout = async () => {
    const version = beginMutation()
    try {
      await service.logout()
      if (version === generation.current) {
        // Match the router's transition priority so a guard cannot race navigation.
        startTransition(() => {
          setUser(null)
          navigate('/', { replace: true })
        })
      }
    } catch (failure) {
      if (version === generation.current) setError({
        operation: 'logout',
        message: 'Não foi possível confirmar sua saída. Sua sessão pode continuar ativa. Tente sair novamente.',
      })
      throw failure
    } finally { finishMutation(version) }
  }
  const retry = async () => {
    if (error?.operation !== 'logout') return refresh()
    try { await logout(); return true } catch { return false }
  }
  return <AuthContext.Provider value={{
    user, isAuthenticated: user?.status === 'ACTIVE', isLoading, isPending, error,
    register, login, logout, retry,
  }}>{children}</AuthContext.Provider>
}
export function useAuth() {
  const context = useContext(AuthContext)
  if (!context) throw new Error('useAuth deve ser usado dentro de AuthProvider')
  return context
}
