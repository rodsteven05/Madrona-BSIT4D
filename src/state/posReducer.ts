import type { CompletedTransaction, PaymentMethod, PosState, Product, Screen } from '../types'

export type PosAction =
  | { type: 'ADD_ITEM'; product: Product }
  | { type: 'INCREMENT'; productId: string }
  | { type: 'DECREMENT'; productId: string }
  | { type: 'REMOVE'; productId: string }
  | { type: 'NAVIGATE'; screen: Screen }
  | { type: 'SELECT_METHOD'; method: PaymentMethod }
  | { type: 'COMPLETE'; transaction: CompletedTransaction }
  | { type: 'SET_FEEDBACK'; message: string }
  | { type: 'RESET' }

export const initialState: PosState = {
  screen: 'items',
  cart: [],
  selectedMethod: null,
  completedTransaction: null,
  feedback: '',
}

export function posReducer(state: PosState, action: PosAction): PosState {
  switch (action.type) {
    case 'ADD_ITEM': {
      const found = state.cart.find((line) => line.product.id === action.product.id)
      const cart = found
        ? state.cart.map((line) => line.product.id === action.product.id ? { ...line, quantity: line.quantity + 1 } : line)
        : [...state.cart, { product: action.product, quantity: 1 }]
      return { ...state, cart, feedback: `${action.product.name} added to your order.` }
    }
    case 'INCREMENT':
      return { ...state, cart: state.cart.map((line) => line.product.id === action.productId ? { ...line, quantity: line.quantity + 1 } : line), feedback: 'Quantity updated.' }
    case 'DECREMENT':
      return { ...state, cart: state.cart.flatMap((line) => line.product.id !== action.productId ? [line] : line.quantity > 1 ? [{ ...line, quantity: line.quantity - 1 }] : []), feedback: 'Quantity updated.' }
    case 'REMOVE':
      return { ...state, cart: state.cart.filter((line) => line.product.id !== action.productId), feedback: 'Item removed from your order.' }
    case 'NAVIGATE':
      return { ...state, screen: action.screen, feedback: '' }
    case 'SELECT_METHOD':
      return { ...state, selectedMethod: action.method, screen: 'payment', feedback: '' }
    case 'COMPLETE':
      return { ...state, completedTransaction: action.transaction, screen: 'success', feedback: 'Transaction completed successfully.' }
    case 'SET_FEEDBACK':
      return { ...state, feedback: action.message }
    case 'RESET':
      return initialState
  }
}
