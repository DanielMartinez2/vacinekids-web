import { Menu, ShoppingBag, X } from 'lucide-react'
import { useRef, useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import logo from '../../assets/branding/vacinekids-logo.svg'
import { useCart } from '../../contexts/CartContext'
import { useAuth } from '../../contexts/AuthContext'
import { LogoutButton } from '../auth/LogoutButton'
import './layout.css'

const navigation = [
  { to: '/', label: 'Início' },
  { to: '/produtos', label: 'Produtos' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { itemCount } = useCart()
  const { user, isAuthenticated, isLoading } = useAuth()
  const menuToggle = useRef<HTMLButtonElement>(null)
  const links = [...navigation, ...(isLoading ? [] : isAuthenticated
    ? [...(user?.role === 'ADMIN' ? [{ to: '/admin', label: 'Administração' }] : [{ to: '/pedidos', label: 'Meus pedidos' }]), { to: '/minha-conta', label: 'Minha conta' }]
    : [{ to: '/login', label: 'Entrar' }, { to: '/cadastro', label: 'Criar conta' }])]

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-link" to="/" aria-label="VacineKids — página inicial">
          <img src={logo} alt="" aria-hidden="true" />
        </Link>

        <button
          className="menu-toggle"
          ref={menuToggle}
          type="button"
          aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isMenuOpen}
          aria-controls="main-navigation"
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav id="main-navigation" className={isMenuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Principal"
          onKeyDown={(event) => { if (event.key === 'Escape') { setIsMenuOpen(false); menuToggle.current?.focus() } }}>
          {links.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
          {isAuthenticated && <LogoutButton className="nav-link nav-button" onSuccess={() => setIsMenuOpen(false)} />}
          <NavLink
            to="/carrinho"
            onClick={() => setIsMenuOpen(false)}
            className={({ isActive }) =>
              isActive ? 'cart-link is-active' : 'cart-link'
            }
          >
            <ShoppingBag size={19} aria-hidden="true" />
            Carrinho
            <span className="cart-count" aria-label={`${itemCount} itens no carrinho`}>
              {itemCount}
            </span>
          </NavLink>
        </nav>
      </div>
    </header>
  )
}
