import { Link } from 'react-router-dom'
import logo from '../../assets/brand/smart-kids-logo.png'

export function Footer() {
  return (
    <footer className="site-footer">
      <div className="container footer-grid">
        <div className="footer-brand">
          <img src={logo} alt="" aria-hidden="true" />
          <div>
            <strong>VacineKids</strong>
            <p>Informação clara para cuidar de quem está crescendo.</p>
          </div>
        </div>
        <nav aria-label="Rodapé">
          <Link to="/">Início</Link>
          <Link to="/produtos">Produtos</Link>
          <Link to="/carrinho">Carrinho</Link>
        </nav>
        <p className="footer-note">
          Conteúdo demonstrativo. A indicação de vacinas deve ser confirmada com um profissional de saúde.
        </p>
      </div>
      <div className="container footer-bottom">© 2026 VacineKids. Projeto demonstrativo.</div>
    </footer>
  )
}
