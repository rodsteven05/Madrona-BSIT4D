import { describe, expect, it } from 'vitest'
import { products } from '../data/products'
import { initialState, posReducer } from './posReducer'

const coffee = products[0]

describe('posReducer', () => {
  it('adds, adjusts, and removes cart items without negative quantities', () => {
    let state = posReducer(initialState, { type: 'ADD_ITEM', product: coffee })
    state = posReducer(state, { type: 'INCREMENT', productId: coffee.id })
    expect(state.cart[0].quantity).toBe(2)
    state = posReducer(state, { type: 'DECREMENT', productId: coffee.id })
    expect(state.cart[0].quantity).toBe(1)
    state = posReducer(state, { type: 'DECREMENT', productId: coffee.id })
    expect(state.cart).toEqual([])
  })

  it('clears all customer state for a new transaction', () => {
    let state = posReducer(initialState, { type: 'ADD_ITEM', product: coffee })
    state = posReducer(state, { type: 'SELECT_METHOD', method: 'Cash' })
    expect(posReducer(state, { type: 'RESET' })).toEqual(initialState)
  })
})
