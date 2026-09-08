import { useEffect, useRef, useState, type FormEvent } from 'react'
import { ApiClientError } from '../../api/httpClient'
import { LogoutButton } from '../../components/auth/LogoutButton'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncStates'
import { Pagination } from '../../components/catalog/Pagination'
import { useAuth } from '../../contexts/AuthContext'
import { customerService, type CustomerService } from '../../services/customerService'
import type { CustomerProfile, Dependent, DependentUpdate } from '../../types/customer'
import {
  birthDateError,
  customerNameError,
  formatBirthDate,
  formatPhone,
  localToday,
  normalizeCustomerName,
  normalizePhoneToE164,
} from '../../utils/customer'
import './account.css'

const PAGE_SIZE = 20

function customerErrorMessage(failure: unknown) {
  if (!(failure instanceof ApiClientError)) return 'Não foi possível concluir a solicitação. Tente novamente.'
  if (failure.kind === 'network' || failure.kind === 'timeout') return failure.message
  if (failure.status === 401) return 'Sua sessão não é mais válida. Estamos verificando seu acesso.'
  if (failure.status === 403) return 'Sua conta não tem permissão para realizar esta ação.'
  if (failure.status === 409 && failure.code === 'PROFILE_REQUIRED') return 'Complete o perfil do responsável antes de cadastrar dependentes.'
  if (failure.status === 422) return 'Verifique os dados informados e tente novamente.'
  if (failure.status === 503) return 'O serviço está temporariamente indisponível. Tente novamente em instantes.'
  return failure.message
}

interface ProfileFormProps {
  profile: CustomerProfile | null
  onCancel?: () => void
  onSaved: (profile: CustomerProfile) => void
  service: CustomerService
  onUnauthorized: () => void
}

function ProfileForm({ profile, onCancel, onSaved, service, onUnauthorized }: ProfileFormProps) {
  const [name, setName] = useState(profile?.name ?? '')
  const [phone, setPhone] = useState(profile ? formatPhone(profile.phone) : '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (error) feedbackRef.current?.focus() }, [error])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const normalizedName = normalizeCustomerName(name)
    const invalidName = customerNameError(normalizedName)
    const normalizedPhone = normalizePhoneToE164(phone)
    const invalid = invalidName ?? (normalizedPhone ? null : 'Informe um telefone válido, com DDD.')
    setError(invalid)
    if (invalid || !normalizedPhone) return
    setSaving(true)
    try {
      const saved = await service.putProfile({ name: normalizedName, phone: normalizedPhone })
      onSaved(saved)
    } catch (failure) {
      setError(customerErrorMessage(failure))
      if (failure instanceof ApiClientError && failure.status === 401) onUnauthorized()
    } finally { setSaving(false) }
  }

  return <form className="account-form" onSubmit={(event) => { void submit(event) }} noValidate aria-busy={saving}>
    {error && <div className="account-message account-message-error" role="alert" tabIndex={-1} ref={feedbackRef}>{error}</div>}
    <div className="account-field">
      <label htmlFor="profile-name">Nome</label>
      <input id="profile-name" name="name" autoComplete="name" maxLength={180} required value={name}
        onChange={(event) => setName(event.target.value)} disabled={saving} />
    </div>
    <div className="account-field">
      <label htmlFor="profile-phone">Telefone</label>
      <input id="profile-phone" name="phone" type="tel" autoComplete="tel" inputMode="tel" maxLength={30} required
        placeholder="(11) 99999-0001" value={phone} onChange={(event) => setPhone(event.target.value)} disabled={saving} />
      <small>Informe o DDD. O número será armazenado no formato internacional.</small>
    </div>
    <div className="account-actions">
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : 'Salvar perfil'}</button>
      {onCancel && <button className="button button-secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>}
    </div>
  </form>
}

interface DependentFormProps {
  dependent?: Dependent
  onCancel: () => void
  onSaved: (dependent: Dependent) => void
  service: CustomerService
  onUnauthorized: () => void
}

function DependentForm({ dependent, onCancel, onSaved, service, onUnauthorized }: DependentFormProps) {
  const [name, setName] = useState(dependent?.name ?? '')
  const [birthDate, setBirthDate] = useState(dependent?.birthDate ?? '')
  const [error, setError] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const feedbackRef = useRef<HTMLDivElement>(null)

  useEffect(() => { if (error) feedbackRef.current?.focus() }, [error])

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    if (saving) return
    const normalizedName = normalizeCustomerName(name)
    const invalid = customerNameError(normalizedName) ?? birthDateError(birthDate)
    setError(invalid)
    if (invalid) return
    setSaving(true)
    try {
      let saved: Dependent
      if (dependent) {
        const changes: DependentUpdate = {}
        if (normalizedName !== dependent.name) changes.name = normalizedName
        if (birthDate !== dependent.birthDate) changes.birthDate = birthDate
        if (Object.keys(changes).length === 0) { onCancel(); return }
        saved = await service.updateDependent(dependent.id, changes)
      } else {
        saved = await service.createDependent({ name: normalizedName, birthDate })
      }
      onSaved(saved)
    } catch (failure) {
      setError(customerErrorMessage(failure))
      if (failure instanceof ApiClientError && failure.status === 401) onUnauthorized()
    } finally { setSaving(false) }
  }

  const prefix = dependent ? `dependent-${dependent.id}` : 'dependent-new'
  return <form className="account-form dependent-form" onSubmit={(event) => { void submit(event) }} noValidate aria-busy={saving}>
    {error && <div className="account-message account-message-error" role="alert" tabIndex={-1} ref={feedbackRef}>{error}</div>}
    <div className="account-field">
      <label htmlFor={`${prefix}-name`}>Nome</label>
      <input id={`${prefix}-name`} name="name" maxLength={180} required value={name}
        onChange={(event) => setName(event.target.value)} disabled={saving} />
    </div>
    <div className="account-field">
      <label htmlFor={`${prefix}-birth-date`}>Data de nascimento</label>
      <input id={`${prefix}-birth-date`} name="birthDate" type="date" required max={localToday()} value={birthDate}
        onChange={(event) => setBirthDate(event.target.value)} disabled={saving} />
    </div>
    <div className="account-actions">
      <button className="button button-primary" type="submit" disabled={saving}>{saving ? 'Salvando...' : dependent ? 'Salvar alterações' : 'Adicionar dependente'}</button>
      <button className="button button-secondary" type="button" onClick={onCancel} disabled={saving}>Cancelar</button>
    </div>
  </form>
}

export function AccountPage({ service = customerService }: { service?: CustomerService }) {
  const auth = useAuth()
  const { user } = auth
  const customer = user?.role === 'CUSTOMER'
  const [profile, setProfile] = useState<CustomerProfile | null>(null)
  const [profileLoading, setProfileLoading] = useState(customer)
  const [profileError, setProfileError] = useState<string | null>(null)
  const [profileEditing, setProfileEditing] = useState(false)
  const [profileReload, setProfileReload] = useState(0)
  const [profileSuccess, setProfileSuccess] = useState<string | null>(null)
  const [dependents, setDependents] = useState<Dependent[]>([])
  const [dependentsLoading, setDependentsLoading] = useState(customer)
  const [dependentsError, setDependentsError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [dependentsReload, setDependentsReload] = useState(0)
  const [adding, setAdding] = useState(false)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [removingId, setRemovingId] = useState<string | null>(null)
  const [removeError, setRemoveError] = useState<{ id: string; message: string } | null>(null)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const successRef = useRef<HTMLDivElement>(null)
  const confirmRef = useRef<HTMLButtonElement>(null)

  const unauthorized = () => { void auth.retry() }

  useEffect(() => {
    if (!customer) return
    let active = true
    const load = async () => {
      setProfileLoading(true)
      setProfileError(null)
      try {
        const result = await service.getProfile()
        if (active) setProfile(result)
      } catch (failure) {
        if (active) setProfileError(customerErrorMessage(failure))
        if (failure instanceof ApiClientError && failure.status === 401) unauthorized()
      } finally { if (active) setProfileLoading(false) }
    }
    void load()
    return () => { active = false }
  // auth.retry is intentionally reached only after an unauthorized customer request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, profileReload, service])

  useEffect(() => {
    if (!customer) return
    let active = true
    const load = async () => {
      setDependentsLoading(true)
      setDependentsError(null)
      try {
        const result = await service.listDependents({ page, pageSize: PAGE_SIZE })
        if (active) {
          setDependents(result.items)
          setTotalPages(Math.max(1, result.meta.totalPages))
        }
      } catch (failure) {
        if (active) setDependentsError(customerErrorMessage(failure))
        if (failure instanceof ApiClientError && failure.status === 401) unauthorized()
      } finally { if (active) setDependentsLoading(false) }
    }
    void load()
    return () => { active = false }
  // auth.retry is intentionally reached only after an unauthorized customer request.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [customer, dependentsReload, page, service])

  useEffect(() => { if (profileSuccess) successRef.current?.focus() }, [profileSuccess])
  useEffect(() => { if (removingId) confirmRef.current?.focus() }, [removingId])

  const dependentSaved = (saved: Dependent) => {
    if (editingId) {
      setDependents((current) => current.map((item) => item.id === saved.id ? saved : item))
      setEditingId(null)
    } else {
      setAdding(false)
      if (page === 1) setDependentsReload((value) => value + 1)
      else setPage(1)
    }
  }

  const removeDependent = async (dependent: Dependent) => {
    if (deletingId) return
    setDeletingId(dependent.id)
    setRemoveError(null)
    try {
      await service.deleteDependent(dependent.id)
      setRemovingId(null)
      if (dependents.length === 1 && page > 1) setPage((current) => current - 1)
      else setDependentsReload((value) => value + 1)
    } catch (failure) {
      setRemoveError({ id: dependent.id, message: customerErrorMessage(failure) })
      if (failure instanceof ApiClientError && failure.status === 401) unauthorized()
    } finally { setDeletingId(null) }
  }

  return <section className="container account-page">
    <header className="account-heading"><p className="auth-eyebrow">Sua conta VacineKids</p><h1>Minha conta</h1></header>

    <section className="account-section" aria-labelledby="access-title">
      <h2 id="access-title">Dados de acesso</h2>
      <dl className="account-details"><dt>Email</dt><dd>{user?.email}</dd><dt>Tipo de conta</dt>
        <dd>{user?.role === 'ADMIN' ? 'Administrador' : 'Cliente'}</dd></dl>
      <LogoutButton />
    </section>

    {customer && <>
      <section className="account-section" aria-labelledby="profile-title">
        <div className="account-section-heading"><div><h2 id="profile-title">Perfil do responsável</h2><p>Dados de contato de quem cuida da conta.</p></div></div>
        {profileSuccess && <div className="account-message account-message-success" role="status" tabIndex={-1} ref={successRef}>{profileSuccess}</div>}
        {profileLoading ? <LoadingState label="Carregando perfil..." />
          : profileError ? <ErrorState message={profileError} onRetry={() => setProfileReload((value) => value + 1)} />
            : profileEditing || !profile ? <>
              {!profile && <p className="account-guidance">Complete seu perfil para cadastrar dependentes.</p>}
              <ProfileForm profile={profile} service={service} onUnauthorized={unauthorized}
                onCancel={profile ? () => setProfileEditing(false) : undefined}
                onSaved={(saved) => {
                  const created = !profile
                  setProfile(saved)
                  setProfileEditing(false)
                  setProfileError(null)
                  setProfileSuccess(created ? 'Perfil criado com sucesso.' : 'Perfil atualizado com sucesso.')
                }} />
            </> : <div className="profile-readonly">
              <dl className="account-details"><dt>Nome</dt><dd>{profile.name}</dd><dt>Telefone</dt><dd>{formatPhone(profile.phone)}</dd></dl>
              <button className="button button-secondary" type="button" onClick={() => { setProfileSuccess(null); setProfileEditing(true) }}>Editar perfil</button>
            </div>}
      </section>

      <section className="account-section" aria-labelledby="dependents-title">
        <div className="account-section-heading"><div><h2 id="dependents-title">Dependentes</h2><p>Cadastre quem você acompanha no VacineKids.</p></div>
          {profile && dependents.length > 0 && !adding && <button className="button button-primary" type="button" onClick={() => { setEditingId(null); setAdding(true) }}>Adicionar dependente</button>}
        </div>
        {!profileLoading && !profile && <p className="account-guidance">Complete o perfil do responsável antes de adicionar dependentes.</p>}
        {adding && profile && <div className="dependent-new"><h3>Novo dependente</h3>
          <DependentForm service={service} onUnauthorized={unauthorized} onCancel={() => setAdding(false)} onSaved={dependentSaved} />
        </div>}
        {dependentsLoading ? <LoadingState label="Carregando dependentes..." />
          : dependentsError ? <ErrorState message={dependentsError} onRetry={() => setDependentsReload((value) => value + 1)} />
            : dependents.length === 0 ? <div className="account-empty"><EmptyState title="Nenhum dependente cadastrado." message={profile ? 'Adicione o primeiro dependente quando quiser.' : 'Complete seu perfil para começar.'} />
              {profile && !adding && <button className="button button-primary" type="button" onClick={() => setAdding(true)}>Adicionar dependente</button>}
            </div> : <>
              <div className="dependent-list">
                {dependents.map((dependent) => <article className="dependent-card" key={dependent.id}>
                  {editingId === dependent.id ? <DependentForm dependent={dependent} service={service} onUnauthorized={unauthorized}
                    onCancel={() => setEditingId(null)} onSaved={dependentSaved} /> : <>
                    <div><h3>{dependent.name}</h3><p>Data de nascimento: <time dateTime={dependent.birthDate}>{formatBirthDate(dependent.birthDate)}</time></p></div>
                    {removeError?.id === dependent.id && <div className="account-message account-message-error" role="alert">{removeError.message}</div>}
                    {removingId === dependent.id ? <div className="remove-confirmation" role="group" aria-label={`Confirmar remoção de ${dependent.name}`}>
                      <strong>Remover este dependente?</strong>
                      <div className="account-actions">
                        <button className="button button-secondary" type="button" onClick={() => { setRemovingId(null); setRemoveError(null) }} disabled={deletingId === dependent.id}>Cancelar</button>
                        <button className="button button-danger" type="button" ref={confirmRef} onClick={() => { void removeDependent(dependent) }} disabled={deletingId === dependent.id}>{deletingId === dependent.id ? 'Removendo...' : 'Confirmar remoção'}</button>
                      </div>
                    </div> : <div className="account-actions">
                      <button className="button button-secondary" type="button" onClick={() => { setAdding(false); setEditingId(dependent.id); setRemovingId(null) }}>Editar</button>
                      <button className="button button-text-danger" type="button" onClick={() => { setEditingId(null); setRemovingId(dependent.id); setRemoveError(null) }}>Remover</button>
                    </div>}
                  </>}
                </article>)}
              </div>
              <Pagination page={page} totalPages={totalPages} label="dependentes" onChange={(nextPage) => { setEditingId(null); setRemovingId(null); setPage(nextPage) }} />
            </>}
      </section>
    </>}
  </section>
}
