import { ArrowLeft, Building2, ShoppingBag, Syringe } from 'lucide-react'
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

export function VaccineDetailsPage() {
  const { id = '' } = useParams()
  const [quantity, setQuantity] = useState(1)
  const [feedback, setFeedback] = useState('')
  const { addItem } = useCart()
  const vaccine = useApiResource(() => catalogService.getVaccine(id), [id])

  if (vaccine.isLoading) return <section className="page-section"><div className="container"><LoadingState label="Carregando detalhes da vacina..." /></div></section>
  if (vaccine.error || !vaccine.data) return <section className="page-section"><div className="container"><ErrorState message={vaccine.error?.message ?? 'Vacina não encontrada.'} onRetry={vaccine.retry} /></div></section>

  const item = vaccine.data
  function addToCart() {
    addItem({ type: 'vaccine', id: item.id, name: item.name, price: Number(item.price), quantity })
    setFeedback(`${quantity} unidade(s) adicionada(s) ao carrinho.`)
  }

  return (
    <section className="details-page">
      <div className="container">
        <Link className="back-link" to="/produtos"><ArrowLeft size={18} aria-hidden="true" /> Voltar ao catálogo</Link>
        <div className="details-grid">
          <article className="details-content">
            <div className="details-icon vaccine-icon"><Syringe aria-hidden="true" /></div>
            <span className="eyebrow">Vacina</span>
            <h1>{item.name}</h1>
            <p className="details-description">{item.description}</p>
            <div className="details-facts">
              <div><Building2 aria-hidden="true" /><span>Fabricante</span><strong>{item.manufacturer}</strong></div>
              <div><span>Faixas etárias</span><div className="tag-list">{item.ageRanges.map((range) => <span className="tag" key={range.id}>{range.name}</span>)}</div></div>
            </div>
            <section className="details-section"><h2>Perguntas frequentes</h2><FaqList faqs={item.faqs} /></section>
          </article>
          <aside className="purchase-card">
            <span>Valor unitário</span>
            <strong className="purchase-price">{formatCurrency(item.price)}</strong>
            <p>Seleção demonstrativa. Nenhum pedido ou agendamento será realizado nesta etapa.</p>
            <QuantitySelector value={quantity} onChange={setQuantity} />
            <button className="button button-primary purchase-button" type="button" onClick={addToCart}><ShoppingBag size={18} aria-hidden="true" /> Adicionar ao carrinho</button>
            <span className="cart-feedback" aria-live="polite">{feedback}</span>
          </aside>
        </div>
      </div>
    </section>
  )
}
