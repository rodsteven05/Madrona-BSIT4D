import type { CSSProperties } from 'react'

const drawings: Record<string, string> = {
  coffee: 'M7 10h14v9a7 7 0 0 1-14 0v-9Zm14 1h3a4 4 0 0 1 0 8h-3M9 5V2m5 3V2m5 3V2M5 29h20',
  sandwich: 'm4 12 12-8 12 8H4Zm0 0v5h24v-5M4 17l4 3 4-3 4 3 4-3 4 3 4-3M4 21v5h24v-5',
  'soft-drink': 'M11 3h10M10 6h12v23H10V6Zm0 8h12m-12 9h12M14 3v3',
  cookies: 'M27 17A12 12 0 1 1 15 5a5 5 0 0 0 6 6 5 5 0 0 0 6 6ZM10 12h.1M9 21h.1M16 18h.1M18 25h.1',
  water: 'M12 2h8v5l3 5v17H9V12l3-5V2Zm0 5h8M9 15h14m-14 8h14',
  chocolate: 'M8 3h16v26H8V3Zm0 8h16M8 19h16M16 3v26',
  'rice-meal': 'M4 17h24a12 12 0 0 1-24 0ZM7 14a9 9 0 0 1 18 0M11 9l2 2m6-3-1 3M6 29h20',
  notebook: 'M8 3h18v26H8V3ZM12 3v26M5 8h6m-6 8h6m-6 8h6M16 10h6m-6 5h6',
  cart: 'M3 4h4l4 16h13l4-11H9M13 27h.1M23 27h.1',
  cash: 'M3 7h26v18H3V7Zm13 5a4 4 0 1 0 0 8 4 4 0 0 0 0-8M7 16h.1m18 0h.1',
  qr: 'M3 3h9v9H3V3Zm17 0h9v9h-9V3ZM3 20h9v9H3v-9Zm17 0h4v4h5v5h-9v-9ZM7 7h1m16 0h1M7 24h1',
  card: 'M3 6h26v20H3V6Zm0 7h26M8 21h6',
}

export function Icon({ name, style }: { name: string; style?: CSSProperties }) {
  return <svg viewBox="0 0 32 32" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true" style={style}><path d={drawings[name] ?? drawings.cart} /></svg>
}
