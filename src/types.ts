export type Screen = 'items' | 'summary' | 'method' | 'payment' | 'success' | 'receipt'
export type PaymentMethod = 'Cash' | 'QR Payment' | 'Credit/Debit Card'

export interface Product {
  id: string
  name: string
  description: string
  category: string
  price: number
  accent: string
  imageUrl?: string
  initials: string
}

export interface CartLine {
  product: Product
  quantity: number
}

export interface TransactionLine {
  productId: string
  name: string
  unitPrice: number
  quantity: number
  subtotal: number
}

export interface CompletedTransaction {
  id: string
  reference: string
  completedAt: string
  items: TransactionLine[]
  total: number
  paymentMethod: PaymentMethod
  amountPaid: number
  change: number
  status: 'Payment Successful'
}

export interface PosState {
  screen: Screen
  cart: CartLine[]
  selectedMethod: PaymentMethod | null
  completedTransaction: CompletedTransaction | null
  feedback: string
}
