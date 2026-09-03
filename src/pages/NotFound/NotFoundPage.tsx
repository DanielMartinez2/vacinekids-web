import { Link } from 'react-router-dom'

export function NotFoundPage() {
  return (
    <section className="page-section">
      <div className="container narrow-card">
        <span className="eyebrow">Erro 404</span>
        <h1>Página não encontrada</h1>
        <p>O endereço acessado não existe nesta demonstração.</p>
        <Link className="button button-primary" to="/">Voltar ao início</Link>
      </div>
    </section>
  )
}
