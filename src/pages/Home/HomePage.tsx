import { ArrowRight, HeartPulse, PackageCheck, ShieldCheck } from 'lucide-react'
import { Link } from 'react-router-dom'
import logo from '../../assets/brand/smart-kids-logo.png'
import './home.css'

const features = [
  { icon: ShieldCheck, title: 'Informação organizada', description: 'Consulte vacinas, fabricantes, indicações e faixas etárias em um só lugar.' },
  { icon: HeartPulse, title: 'Busca sem complicação', description: 'Encontre opções pelo nome e filtre o catálogo conforme a idade da criança.' },
  { icon: PackageCheck, title: 'Pacotes transparentes', description: 'Veja a composição e o valor de cada pacote antes de adicioná-lo ao carrinho.' },
]

export function HomePage() {
  return (
    <>
      <section className="hero">
        <div className="container hero-grid">
          <div className="hero-copy">
            <span className="eyebrow">Catálogo digital de vacinação infantil</span>
            <h1>Um catálogo mais simples para escolhas mais tranquilas.</h1>
            <p>Explore vacinas e pacotes com informações claras, compare possibilidades e organize sua seleção em poucos passos.</p>
            <div className="hero-actions">
              <Link className="button button-primary" to="/produtos">Explorar produtos <ArrowRight size={18} aria-hidden="true" /></Link>
              <button className="button button-secondary" type="button" onClick={() => document.getElementById('como-funciona')?.scrollIntoView({ behavior: 'smooth' })}>Como funciona</button>
            </div>
          </div>
          <div className="hero-visual" aria-label="Identidade visual Smart Kids">
            <span className="visual-orbit visual-orbit-one" aria-hidden="true" />
            <span className="visual-orbit visual-orbit-two" aria-hidden="true" />
            <div className="logo-card">
              <span>Cuidado que acompanha cada fase</span>
              <img src={logo} alt="Smart Kids" />
              <strong>Informar. Escolher. Cuidar.</strong>
            </div>
          </div>
        </div>
      </section>

      <section className="page-section" id="como-funciona">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Como funciona</span>
            <h2>O essencial, com uma experiência leve.</h2>
            <p>Uma demonstração de catálogo focada em clareza, navegação e integração real com a API.</p>
          </div>
          <div className="feature-grid">
            {features.map(({ icon: Icon, title, description }, index) => (
              <article className="feature-card" key={title}>
                <span className="feature-number">0{index + 1}</span>
                <div className="feature-icon"><Icon aria-hidden="true" /></div>
                <h3>{title}</h3>
                <p>{description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section className="home-cta">
        <div className="container cta-card">
          <div>
            <span className="eyebrow eyebrow-light">Pronto para conhecer?</span>
            <h2>Encontre a opção certa para cada fase.</h2>
          </div>
          <Link className="button button-light" to="/produtos">Ver catálogo <ArrowRight size={18} aria-hidden="true" /></Link>
        </div>
      </section>
    </>
  )
}
