import { ArrowLeft, Boxes, ShoppingBag, Syringe } from 'lucide-react'
import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ErrorState, LoadingState } from '../../components/common/AsyncStates'
import { FaqList } from '../../components/common/FaqList'
import { QuantitySelector } from '../../components/catalog/QuantitySelector'
import { useCart } from '../../contexts/CartContext'
import { useApiResource } from '../../hooks/useApiResource'
import { catalogService } from '../../services/catalogService'
import { formatCurrency } from '../../utils/format'
import './details.css'

export function PackageDetailsPage() {
  const { id = '' } = useParams()
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState('')
  const { addItem } = useCart()
  const packageResource = useApiResource(() => catalogService.getPackage(id), [id])

  if (packageResource.isLoading) return <section className="page-section"><div className="container"><LoadingState label="Carregando detalhes do pacote..." /></div></section>
  if (packageResource.error || !packageResource.data) return <section className="page-section"><div className="container"><ErrorState message={packageResource.error?.message ?? 'Pacote não encontrado.'} onRetry={packageResource.retry} /></div></section>

  const item = packageResource.data
  function addToCart() {
    addItem({ type: 'package', id: item.id, name: item.name, price: Number(item.price), quantity })
    setFeedback(`${quantity} pacote(s) adicionado(s) ao carrinho.`)
  }

  return (
    <section className="details-page">
      <div className="container">
        <Link className="back-link" to="/produtos"><ArrowLeft size={18} aria-hidden="true" /> Voltar ao catálogo</Link>
        <div className="details-grid">
          <article className="details-content">
            <div className="details-icon package-icon"><Boxes aria-hidden="true" /></div>
            <span className="eyebrow">Pacote</span>
            <h1>{item.name}</h1>
            <p className="details-description">{item.description}</p>
            <section className="details-section">
              <h2>O que está incluído</h2>
              <div className="composition-list">
                {item.vaccines.map(({ quantity: vaccineQuantity, vaccine }) => (
                  <Link to={`/vacinas/${vaccine.id}`} className="composition-item" key={vaccine.id}>
                    <Syringe aria-hidden="true" />
                    <div><strong>{vaccine.name}</strong><span>{vaccine.manufacturer}</span></div>
                    <b>{vaccineQuantity}×</b>
                  </Link>
                ))}
              </div>
            </section>
            <section className="details-section"><h2>Perguntas frequentes</h2><FaqList faqs={item.faqs} /></section>
          </article>
          <aside className="purchase-card">
            <span>Valor do pacote</span>
            <strong className="purchase-price">{formatCurrency(item.price)}</strong>
            <p>Seleção demonstrativa. Nenhum pedido ou agendamento será realizado nesta etapa.</p>
            <QuantitySelector value={quantity} onChange={setQuantity} label="Quantidade de pacotes" />
            <button className="button button-primary purchase-button" type="button" onClick={addToCart}><ShoppingBag size={18} aria-hidden="true" /> Adicionar ao carrinho</button>
            <span className="cart-feedback" aria-live="polite">{feedback}</span>
          </aside>
        </div>
      </div>
    </section>
  )
}
