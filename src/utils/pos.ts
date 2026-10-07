import type { CartLine, PaymentMethod, TransactionLine } from '../types'

export const formatCurrency = (centavos: number) =>
  new Intl.NumberFormat('en-PH', { style: 'currency', currency: 'PHP' }).format(centavos / 100)

export const lineSubtotal = (line: CartLine) => line.product.price * line.quantity

export const cartTotal = (cart: CartLine[]) => cart.reduce((total, line) => total + lineSubtotal(line), 0)

export const toTransactionLines = (cart: CartLine[]): TransactionLine[] =>
  cart.map(({ product, quantity }) => ({
    productId: product.id,
    name: product.name,
    unitPrice: product.price,
    quantity,
    subtotal: product.price * quantity,
  }))

export const validateCash = (rawAmount: string, total: number) => {
  if (!rawAmount.trim()) return 'Enter the amount paid.'
  const amount = Number(rawAmount)
  if (!Number.isFinite(amount) || amount < 0) return 'Enter a valid, non-negative payment amount.'
  const centavos = Math.round(amount * 100)
  if (centavos < total) return `Insufficient payment. Please enter at least ${formatCurrency(total)}.`
  return null
}

export const paidAmountFor = (method: PaymentMethod, total: number, cashAmount: string) =>
  method === 'Cash' ? Math.round(Number(cashAmount) * 100) : total

export const createReference = () => `TXN-${crypto.randomUUID().toUpperCase()}`
