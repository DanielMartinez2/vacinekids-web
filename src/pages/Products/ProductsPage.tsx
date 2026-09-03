import { Search, SlidersHorizontal } from 'lucide-react'
import { type FormEvent, useState } from 'react'
import { EmptyState, ErrorState, LoadingState } from '../../components/common/AsyncStates'
import { Pagination } from '../../components/catalog/Pagination'
import { ProductCard } from '../../components/catalog/ProductCard'
import { useApiResource } from '../../hooks/useApiResource'
import { catalogService } from '../../services/catalogService'
import './products.css'

const PAGE_SIZE = 6

export function ProductsPage() {
  const [searchInput, setSearchInput] = useState('')
  const [search, setSearch] = useState('')
  const [ageRange, setAgeRange] = useState('')
  const [vaccinePage, setVaccinePage] = useState(1)
  const [packagePage, setPackagePage] = useState(1)

  const ages = useApiResource(() => catalogService.listAgeRanges(), [])
  const vaccines = useApiResource(
    () => catalogService.listVaccines({ page: vaccinePage, pageSize: PAGE_SIZE, search, ageRange }),
    [vaccinePage, search, ageRange],
  )
  const packages = useApiResource(
    () => catalogService.listPackages({ page: packagePage, pageSize: PAGE_SIZE, search, ageRange }),
    [packagePage, search, ageRange],
  )

  function submitSearch(event: FormEvent) {
    event.preventDefault()
    setSearch(searchInput.trim())
    setVaccinePage(1)
    setPackagePage(1)
  }

  function changeAgeRange(value: string) {
    setAgeRange(value)
    setVaccinePage(1)
    setPackagePage(1)
  }

  return (
    <section className="catalog-page">
      <div className="catalog-intro">
        <div className="container">
          <span className="eyebrow">Catálogo VacineKids</span>
          <h1>Vacinas e pacotes para cada fase.</h1>
          <p>Consulte as informações disponíveis na API e monte uma seleção demonstrativa no carrinho.</p>
        </div>
      </div>

      <div className="container catalog-layout">
        <aside className="catalog-filters" aria-label="Filtros do catálogo">
          <div className="filter-title"><SlidersHorizontal size={19} aria-hidden="true" /><strong>Filtrar catálogo</strong></div>
          <form onSubmit={submitSearch} className="search-form">
            <label htmlFor="catalog-search">Buscar por texto</label>
            <div className="search-control">
              <input id="catalog-search" value={searchInput} onChange={(event) => setSearchInput(event.target.value)} placeholder="Nome, descrição..." />
              <button type="submit" aria-label="Buscar"><Search size={18} aria-hidden="true" /></button>
            </div>
          </form>
          <fieldset>
            <legend>Faixa etária</legend>
            <label className="radio-filter"><input type="radio" name="age" checked={!ageRange} onChange={() => changeAgeRange('')} /> Todas as idades</label>
            {ages.isLoading && <span className="filter-help">Carregando faixas...</span>}
            {ages.error && (
              <span className="filter-error">
                Faixas indisponíveis.
                <button type="button" onClick={ages.retry}>Tentar novamente</button>
              </span>
            )}
            {ages.data?.map((range) => (
              <label className="radio-filter" key={range.id}>
                <input type="radio" name="age" checked={ageRange === range.slug} onChange={() => changeAgeRange(range.slug)} /> {range.name}
              </label>
            ))}
          </fieldset>
          {(search || ageRange) && (
            <button className="clear-filters" type="button" onClick={() => { setSearch(''); setSearchInput(''); changeAgeRange('') }}>Limpar filtros</button>
          )}
        </aside>

        <div className="catalog-content">
          <section className="catalog-group" aria-labelledby="vaccines-title">
            <div className="group-heading"><div><span>Catálogo individual</span><h2 id="vaccines-title">Vacinas</h2></div>{vaccines.data && <small>{vaccines.data.meta.total} resultado(s)</small>}</div>
            {vaccines.isLoading ? <LoadingState label="Carregando vacinas..." /> : vaccines.error ? <ErrorState message={vaccines.error.message} onRetry={vaccines.retry} /> : vaccines.data?.items.length ? (
              <><div className="product-grid">{vaccines.data.items.map((vaccine) => <ProductCard key={vaccine.id} type="vaccine" product={vaccine} />)}</div><Pagination page={vaccines.data.meta.page} totalPages={vaccines.data.meta.totalPages} onChange={setVaccinePage} label="vacinas" /></>
            ) : <EmptyState message="Tente remover algum filtro ou buscar por outro termo." />}
          </section>

          <section className="catalog-group" aria-labelledby="packages-title">
            <div className="group-heading"><div><span>Combinações disponíveis</span><h2 id="packages-title">Pacotes</h2></div>{packages.data && <small>{packages.data.meta.total} resultado(s)</small>}</div>
            {packages.isLoading ? <LoadingState label="Carregando pacotes..." /> : packages.error ? <ErrorState message={packages.error.message} onRetry={packages.retry} /> : packages.data?.items.length ? (
              <><div className="product-grid">{packages.data.items.map((packageItem) => <ProductCard key={packageItem.id} type="package" product={packageItem} />)}</div><Pagination page={packages.data.meta.page} totalPages={packages.data.meta.totalPages} onChange={setPackagePage} label="pacotes" /></>
            ) : <EmptyState message="Nenhum pacote corresponde à busca e à faixa etária escolhidas." />}
          </section>
        </div>
      </div>
    </section>
  )
}
