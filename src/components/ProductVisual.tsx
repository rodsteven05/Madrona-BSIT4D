import { useState } from 'react'
import type { Product } from '../types'
import { Icon } from './Icon'

export function ProductVisual({ product }: { product: Product }) {
  const [failed, setFailed] = useState(false)
  const showPhoto = Boolean(product.imageUrl) && !failed
  return (
    <span className={`product-visual ${showPhoto ? 'has-photo' : ''}`} style={{ color: product.accent }}>
      {showPhoto ? <img src={product.imageUrl} alt="" loading="lazy" onError={() => setFailed(true)} /> : <Icon name={product.id} />}
      <span className="product-add" aria-hidden="true">+</span>
    </span>
  )
}
