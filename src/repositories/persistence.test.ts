import { beforeEach, describe, expect, it, vi } from 'vitest'
import type { CompletedTransaction } from '../types'

const mock = vi.hoisted(() => ({ rpc: vi.fn(), from: vi.fn(), client: null as unknown }))
vi.mock('../lib/supabase', () => ({
  get supabase() { return mock.client },
  get usesSupabase() { return Boolean(mock.client) },
}))
const transaction: CompletedTransaction = {
  id: '4acf8af7-e73a-4bcc-8bf3-985ec1ac9a02', reference: 'TXN-TEST',
  completedAt: '2026-10-07T12:00:00.000Z', total: 4500, paymentMethod: 'Cash',
  amountPaid: 5000, change: 500, status: 'Payment Successful',
  items: [{ productId: 'coffee', name: 'Brewed Coffee', unitPrice: 4500, quantity: 1, subtotal: 4500 }],
}

beforeEach(() => { vi.resetModules(); vi.clearAllMocks(); localStorage.clear(); mock.client = null })

describe('transaction persistence', () => {
  it('stores a local receipt once and rejects conflicting ID reuse', async () => {
    const { transactionRepository } = await import('./transactions')
    await transactionRepository.save(transaction)
    await transactionRepository.save(transaction)
    expect(JSON.parse(localStorage.getItem('campus-pos-transactions')!)).toEqual([transaction])
    await expect(transactionRepository.save({ ...transaction, amountPaid: 6000, change: 1500 })).rejects.toThrow('ID conflict')
  })
  it('sends receipt snapshots through the atomic Supabase RPC', async () => {
    mock.client = { rpc: mock.rpc }
    mock.rpc.mockResolvedValue({ data: transaction.id, error: null })
    const { transactionRepository } = await import('./transactions')
    await transactionRepository.save(transaction)
    expect(mock.rpc).toHaveBeenCalledWith('create_pos_transaction', { transaction_data: {
      id: transaction.id, reference: transaction.reference, completed_at: transaction.completedAt,
      total: 4500, payment_method: 'Cash', amount_paid: 5000, change_amount: 500, status: 'Payment Successful',
      items: [{ product_id: 'coffee', product_name: 'Brewed Coffee', unit_price: 4500, quantity: 1, subtotal: 4500 }],
    } })
    expect(localStorage.getItem('campus-pos-transactions')).toBeNull()
  })
  it('propagates a database rejection without local fallback', async () => {
    mock.client = { rpc: mock.rpc }
    mock.rpc.mockResolvedValue({ error: new Error('Invalid total') })
    const { transactionRepository } = await import('./transactions')
    await expect(transactionRepository.save(transaction)).rejects.toThrow('Invalid total')
    expect(localStorage.getItem('campus-pos-transactions')).toBeNull()
  })
})

describe('catalog persistence', () => {
  it('loads active Supabase products and retains existing visuals', async () => {
    const order = vi.fn().mockReturnThis()
    order.mockReturnValueOnce({ order }).mockResolvedValueOnce({ data: [{ id: 'coffee', name: 'Brewed Coffee', price: 4600, category: 'Drinks', description: 'Updated' }], error: null })
    const eq = vi.fn().mockReturnValue({ order })
    const select = vi.fn().mockReturnValue({ eq })
    mock.from.mockReturnValue({ select })
    mock.client = { from: mock.from }
    const { loadProducts } = await import('./products')
    const catalog = await loadProducts()
    expect(mock.from).toHaveBeenCalledWith('products')
    expect(eq).toHaveBeenCalledWith('active', true)
    expect(catalog[0]).toMatchObject({ price: 4600, initials: 'BC' })
  })
  it('uses eight demo products without a database', async () => {
    const { loadProducts } = await import('./products')
    expect(await loadProducts()).toHaveLength(8)
  })
})
