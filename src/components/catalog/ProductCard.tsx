import { Boxes, Plus, Syringe } from 'lucide-react'
import { Link } from 'react-router-dom'
import { useCart } from '../../contexts/CartContext'
import type { Vaccine, VaccinePackage } from '../../types/catalog'
import { formatCurrency } from '../../utils/format'
import './catalog.css'

type ProductCardProps =
  | { type: 'vaccine'; product: Vaccine }
  | { type: 'package'; product: VaccinePackage }

export function ProductCard(props: ProductCardProps) {
  const { addItem } = useCart()
  const { product, type } = props
  const isVaccine = type === 'vaccine'
  const detailUrl = isVaccine ? `/vacinas/${product.id}` : `/pacotes/${product.id}`
  const Icon = isVaccine ? Syringe : Boxes
  const tags = isVaccine
    ? product.ageRanges.map((range) => range.name)
    : product.vaccines.slice(0, 3).map((item) => `${item.quantity}× ${item.vaccine.name}`)

  return (
    <article className="product-card">
      <div className={isVaccine ? 'product-icon vaccine-icon' : 'product-icon package-icon'}><Icon aria-hidden="true" /></div>
      <span className="product-type">{isVaccine ? 'Vacina' : 'Pacote'}</span>
      <h3><Link to={detailUrl}>{product.name}</Link></h3>
      <p className="product-description">{product.description}</p>
      <div className="tag-list" aria-label={isVaccine ? 'Faixas etárias' : 'Composição resumida'}>
        {tags.map((tag) => <span className="tag" key={tag}>{tag}</span>)}
      </div>
      <div className="product-card-footer">
        <strong className="price">{formatCurrency(product.price)}</strong>
        <div className="card-actions">
          <Link className="details-link" to={detailUrl}>Detalhes</Link>
          <button
            className="icon-button"
            type="button"
            aria-label={`Adicionar ${product.name} ao carrinho`}
            onClick={() => addItem({ type, id: product.id, name: product.name, price: Number(product.price) })}
          ><Plus aria-hidden="true" /></button>
        </div>
      </div>
    </article>
  )
}
