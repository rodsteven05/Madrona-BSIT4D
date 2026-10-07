import { products } from '../data/products'
import { supabase } from '../lib/supabase'
import type { Product } from '../types'

export async function loadProducts(): Promise<Product[]> {
  if (!supabase) return products
  const { data, error } = await supabase.from('products')
    .select('id,name,description,category,price').eq('active', true).order('created_at').order('id')
  if (error) throw error
  if (!data?.length) throw new Error('No active products are available.')
  return data.map((row) => {
    if (!Number.isSafeInteger(row.price) || row.price < 0) throw new Error('Invalid catalog price.')
    const visual = products.find((product) => product.id === row.id)
    return { ...row, accent: visual?.accent ?? '#173f32', initials: visual?.initials ?? row.name.slice(0, 2).toUpperCase() }
  })
}
