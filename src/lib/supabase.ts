import { createClient } from '@supabase/supabase-js'

const url = import.meta.env.VITE_SUPABASE_URL
const publicKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY || import.meta.env.VITE_SUPABASE_ANON_KEY

if (Boolean(url) !== Boolean(publicKey)) throw new Error('Configure both the Supabase URL and public key.')
if (publicKey?.startsWith('sb_secret_')) throw new Error('Use a Supabase publishable key in the frontend.')

export const supabase = url && publicKey ? createClient(url, publicKey) : null
export const usesSupabase = Boolean(supabase)
