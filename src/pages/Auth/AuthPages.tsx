import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../../contexts/AuthContext'
import { authFormError, safeLoginDestination, validateAuthForm } from '../../utils/auth'
import './auth.css'

function AuthForm({ registration = false }: { registration?: boolean }) {
  const auth = useAuth()
  const navigate = useNavigate()
  const location = useLocation()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [confirmation, setConfirmation] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [success, setSuccess] = useState(false)
  const feedback = useRef<HTMLDivElement>(null)
  useEffect(() => { if (error || success) feedback.current?.focus() }, [error, success])

  if (auth.isAuthenticated && !auth.isLoading && !auth.error) return <Navigate to={safeLoginDestination(location.state)} replace />
  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (sending || auth.isLoading || auth.isPending) return
    const invalid = validateAuthForm(email, password, registration ? confirmation : undefined)
    setError(invalid)
    if (invalid) return
    setSending(true)
    try {
      if (registration) {
        await auth.register(email, password)
        setPassword('')
        setConfirmation('')
        setSuccess(true)
      } else {
        await auth.login(email, password)
        navigate(safeLoginDestination(location.state), { replace: true })
      }
    } catch (failure) { setError(authFormError(failure, !registration)) }
    finally { setSending(false) }
  }
  const disabled = sending || auth.isLoading || auth.isPending
  return <section className="container auth-page">
    <div className="auth-card">
      <p className="auth-eyebrow">Sua conta VacineKids</p>
      <h1>{registration ? 'Criar conta' : 'Entrar'}</h1>
      <p>{registration ? 'Um espaço para acompanhar seus próximos passos.' : 'Entre com seu email e senha.'}</p>
      {success ? <div className="auth-success" role="status" tabIndex={-1} ref={feedback}>
        <p>Cadastro processado. Agora você pode entrar.</p>
        <Link className="button button-primary" to="/login" state={location.state}>Entrar</Link>
      </div> : <form onSubmit={(event) => { void submit(event) }} noValidate aria-busy={sending} aria-describedby={error ? 'auth-form-error' : undefined}>
        {error && <div id="auth-form-error" className="auth-form-error" role="alert" tabIndex={-1} ref={feedback}>{error}</div>}
        <div className="auth-field"><label htmlFor="auth-email">Email</label>
          <input id="auth-email" name="email" type="email" autoComplete="email" required maxLength={254}
            value={email} onChange={(event) => setEmail(event.target.value)} onBlur={() => setEmail((value) => value.trim())}
            disabled={disabled} autoCapitalize="none" spellCheck={false} />
        </div>
        <div className="auth-field"><label htmlFor="auth-password">Senha</label>
          <input id="auth-password" name="password" type="password" autoComplete={registration ? 'new-password' : 'current-password'}
            required value={password} onChange={(event) => setPassword(event.target.value)} disabled={disabled}
            aria-describedby={registration ? 'password-hint' : undefined} />
          {registration && <small id="password-hint">De 15 a 128 caracteres. Você pode usar espaços, Unicode e frases como senha.</small>}
        </div>
        {registration && <div className="auth-field"><label htmlFor="auth-confirmation">Confirmar senha</label>
          <input id="auth-confirmation" name="confirmation" type="password" autoComplete="new-password" required
            value={confirmation} onChange={(event) => setConfirmation(event.target.value)} disabled={disabled} />
        </div>}
        <button className="button button-primary" type="submit" disabled={disabled}>{sending ? 'Enviando...' : registration ? 'Criar conta' : 'Entrar'}</button>
        <p className="auth-switch">{registration ? 'Já tem uma conta? ' : 'Ainda não tem conta? '}
          <Link to={registration ? '/login' : '/cadastro'} state={location.state}>{registration ? 'Entrar' : 'Criar conta'}</Link>
        </p>
      </form>}
    </div>
  </section>
}
export function LoginPage() { return <AuthForm /> }
export function RegisterPage() { return <AuthForm registration /> }
export function AdminPage() {
  return <section className="container auth-page"><div className="auth-card">
    <p className="auth-eyebrow">VacineKids</p><h1>Área administrativa</h1>
    <p>A interface administrativa será implementada em uma fase futura.</p>
  </div></section>
}
