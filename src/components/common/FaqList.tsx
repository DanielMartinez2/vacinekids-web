import type { Faq } from '../../types/catalog'
import './common.css'

export function FaqList({ faqs }: { faqs: Faq[] }) {
  if (faqs.length === 0) return <p>Não há perguntas frequentes cadastradas para este item.</p>
  return (
    <div className="faq-list">
      {faqs.map((faq, index) => (
        <details className="faq-item" key={faq.id ?? `${faq.question}-${index}`}>
          <summary>{faq.question}</summary>
          <p>{faq.answer}</p>
        </details>
      ))}
    </div>
  )
}
