import { Menu, ShoppingBag, X } from 'lucide-react'
import { useState } from 'react'
import { Link, NavLink } from 'react-router-dom'
import logo from '../../assets/brand/smart-kids-logo.png'
import { useCart } from '../../contexts/CartContext'
import './layout.css'

const navigation = [
  { to: '/', label: 'Início' },
  { to: '/produtos', label: 'Produtos' },
]

export function Header() {
  const [isMenuOpen, setIsMenuOpen] = useState(false)
  const { itemCount } = useCart()

  return (
    <header className="site-header">
      <div className="container header-inner">
        <Link className="brand-link" to="/" aria-label="VacineKids — página inicial">
          <img src={logo} alt="Smart Kids" />
          <span>VacineKids</span>
        </Link>

        <button
          className="menu-toggle"
          type="button"
          aria-label={isMenuOpen ? 'Fechar menu' : 'Abrir menu'}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          {isMenuOpen ? <X aria-hidden="true" /> : <Menu aria-hidden="true" />}
        </button>

        <nav className={isMenuOpen ? 'main-nav is-open' : 'main-nav'} aria-label="Principal">
          {navigation.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              onClick={() => setIsMenuOpen(false)}
              className={({ isActive }) => (isActive ? 'nav-link is-active' : 'nav-link')}
            >
              {item.label}
            </NavLink>
          ))}
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
