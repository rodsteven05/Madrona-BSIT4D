import { describe, expect, it } from 'vitest'
import { products } from '../data/products'
import { cartTotal, formatCurrency, validateCash } from './pos'

const cart = [
  { product: products[0], quantity: 2 },
  { product: products[1], quantity: 1 },
  { product: products[2], quantity: 1 },
]

describe('POS calculations', () => {
  it('calculates the instructor sample order', () => {
    expect(cartTotal(cart)).toBe(17500)
    expect(formatCurrency(17500)).toContain('175.00')
  })

  it('validates cash payments', () => {
    expect(validateCash('', 14000)).toBe('Enter the amount paid.')
    expect(validateCash('-1', 14000)).toContain('non-negative')
    expect(validateCash('100', 14000)).toContain('Insufficient payment')
    expect(validateCash('140', 14000)).toBeNull()
    expect(validateCash('200', 14000)).toBeNull()
  })
})
