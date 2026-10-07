import { supabase, usesSupabase } from '../lib/supabase'
import type { CompletedTransaction } from '../types'

const storageKey = 'campus-pos-transactions'

interface TransactionRepository {
  save(transaction: CompletedTransaction): Promise<void>
}

const localRepository: TransactionRepository = {
  async save(transaction) {
    const existing = JSON.parse(localStorage.getItem(storageKey) ?? '[]') as CompletedTransaction[]
    const previous = existing.find((entry) => entry.id === transaction.id)
    if (previous) {
      if (JSON.stringify(previous) !== JSON.stringify(transaction)) throw new Error('Transaction ID conflict.')
      return
    }
    if (existing.some((entry) => entry.reference === transaction.reference)) throw new Error('Transaction reference conflict.')
    localStorage.setItem(storageKey, JSON.stringify([...existing, transaction]))
  },
}

const supabaseRepository: TransactionRepository = {
  async save(transaction) {
    if (!supabase) throw new Error('Supabase is not configured.')
    const { error } = await supabase.rpc('create_pos_transaction', {
      transaction_data: {
        id: transaction.id,
        reference: transaction.reference,
        completed_at: transaction.completedAt,
        total: transaction.total,
        payment_method: transaction.paymentMethod,
        amount_paid: transaction.amountPaid,
        change_amount: transaction.change,
        status: transaction.status,
        items: transaction.items.map((item) => ({
          product_id: item.productId,
          product_name: item.name,
          unit_price: item.unitPrice,
          quantity: item.quantity,
          subtotal: item.subtotal,
        })),
      },
    })
    if (error) throw error
  },
}

export const transactionRepository = usesSupabase ? supabaseRepository : localRepository
export const persistenceLabel = usesSupabase ? 'Supabase configured' : 'Local demo mode'
