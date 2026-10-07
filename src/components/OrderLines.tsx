import type { CartLine } from '../types'
import { formatCurrency, lineSubtotal } from '../utils/pos'

interface Props {
  cart: CartLine[]
  editable?: boolean
  onIncrement?: (id: string) => void
  onDecrement?: (id: string) => void
  onRemove?: (id: string) => void
}

export function OrderLines({ cart, editable = false, onIncrement, onDecrement, onRemove }: Props) {
  return (
    <div className="order-lines">
      {cart.map((line) => (
        <article className="order-line" key={line.product.id}>
          <div className="line-main">
            <strong>{line.product.name}</strong>
            <span>{formatCurrency(line.product.price)} each</span>
          </div>
          {editable ? (
            <div className="quantity-control" aria-label={`Quantity for ${line.product.name}`}>
              <button type="button" onClick={() => onDecrement?.(line.product.id)} aria-label={`Decrease ${line.product.name}`}>−</button>
              <output aria-label={`${line.product.name} quantity`}>{line.quantity}</output>
              <button type="button" onClick={() => onIncrement?.(line.product.id)} aria-label={`Increase ${line.product.name}`}>+</button>
            </div>
          ) : <span className="quantity-text">× {line.quantity}</span>}
          <strong className="line-subtotal">{formatCurrency(lineSubtotal(line))}</strong>
          {editable && <button className="remove-button" type="button" onClick={() => onRemove?.(line.product.id)}>Remove</button>}
        </article>
      ))}
    </div>
  )
}
