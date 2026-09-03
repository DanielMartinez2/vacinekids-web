import { ArrowRight, ShoppingBag, Trash2 } from 'lucide-react'
import { Link } from 'react-router-dom'
import { QuantitySelector } from '../../components/catalog/QuantitySelector'
import { useCart } from '../../contexts/CartContext'
import { formatCurrency } from '../../utils/format'
import './cart.css'

export function CartPage() {
  const { items, itemCount, subtotal, removeItem, setQuantity, clearCart } = useCart()

  return (
    <section className="cart-page">
      <div className="container">
        <div className="cart-heading">
          <span className="eyebrow">Sua seleção</span>
          <h1>Carrinho</h1>
          <p>{itemCount === 0 ? 'Nenhum item selecionado.' : `${itemCount} item(ns) na sua seleção demonstrativa.`}</p>
        </div>

        {items.length === 0 ? (
          <div className="empty-cart">
            <ShoppingBag aria-hidden="true" />
            <h2>Seu carrinho está vazio</h2>
            <p>Explore o catálogo e adicione vacinas ou pacotes para vê-los aqui.</p>
            <Link className="button button-primary" to="/produtos">Explorar produtos <ArrowRight size={18} aria-hidden="true" /></Link>
          </div>
        ) : (
          <div className="cart-grid">
            <div className="cart-items">
              <div className="cart-items-header"><strong>Itens selecionados</strong><button type="button" onClick={clearCart}>Limpar carrinho</button></div>
              {items.map((item) => (
                <article className="cart-item" key={`${item.type}-${item.id}`}>
                  <div className={item.type === 'vaccine' ? 'cart-item-marker vaccine-marker' : 'cart-item-marker package-marker'}>{item.type === 'vaccine' ? 'V' : 'P'}</div>
                  <div className="cart-item-info">
                    <span>{item.type === 'vaccine' ? 'Vacina' : 'Pacote'}</span>
                    <Link to={item.type === 'vaccine' ? `/vacinas/${item.id}` : `/pacotes/${item.id}`}>{item.name}</Link>
                    <small>{formatCurrency(item.price)} por unidade</small>
                  </div>
                  <QuantitySelector value={item.quantity} onChange={(quantity) => setQuantity(item.type, item.id, quantity)} label="Qtd." />
                  <strong className="cart-line-total">{formatCurrency(item.price * item.quantity)}</strong>
                  <button className="remove-item" type="button" aria-label={`Remover ${item.name}`} onClick={() => removeItem(item.type, item.id)}><Trash2 size={18} aria-hidden="true" /></button>
                </article>
              ))}
            </div>

            <aside className="cart-summary">
              <h2>Resumo</h2>
              <div><span>Itens</span><strong>{itemCount}</strong></div>
              <div><span>Subtotal</span><strong>{formatCurrency(subtotal)}</strong></div>
              <div className="summary-total"><span>Total</span><strong>{formatCurrency(subtotal)}</strong></div>
              <button className="button checkout-disabled" type="button" disabled>Finalização indisponível</button>
              <p>Pedidos, pagamentos e agendamentos serão implementados em um marco futuro.</p>
            </aside>
          </div>
        )}
      </div>
    </section>
  )
}
