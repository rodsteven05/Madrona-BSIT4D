import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it, vi } from 'vitest'
import App from './App'
import { transactionRepository } from './repositories/transactions'

vi.mock('./lib/supabase', () => ({ supabase: null, usesSupabase: false }))

beforeEach(() => { localStorage.clear(); vi.restoreAllMocks() })

describe('complete cash checkout', () => {
  it('rejects insufficient cash then creates a correct receipt and resets', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click((await screen.findAllByRole('button', { name: /Brewed Coffee/ }))[0])
    await user.click((await screen.findAllByRole('button', { name: /Brewed Coffee/ }))[0])
    await user.click(screen.getAllByRole('button', { name: /Club Sandwich/ })[0])
    await user.click(screen.getAllByRole('button', { name: /Soft Drink/ })[0])
    expect(screen.getAllByText(/₱175\.00/).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Review Order/ }))
    await user.click(screen.getByRole('button', { name: /Continue to Payment/ }))
    await user.click(screen.getByRole('button', { name: /^Cash/ }))

    const input = screen.getByLabelText('Amount paid')
    await user.type(input, '100')
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Insufficient payment')

    await user.clear(input)
    await user.type(input, '200')
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))
    expect(await screen.findByText('Thank you for your purchase')).toBeInTheDocument()
    expect(screen.getByText(/TXN-/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: /View Receipt/ }))
    expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    expect(screen.getAllByText(/₱25\.00/).length).toBeGreaterThan(0)

    await user.click(screen.getByRole('button', { name: /Start New Transaction/ }))
    expect(screen.getByText('Your order is empty')).toBeInTheDocument()
    expect(screen.getByText(/₱0\.00/)).toBeInTheDocument()
  })
})

async function openPayment(method: string) {
  const user = userEvent.setup()
  render(<App />)
  await user.click((await screen.findAllByRole('button', { name: /Brewed Coffee/ }))[0])
  await user.click(screen.getByRole('button', { name: /Review Order/ }))
  await user.click(screen.getByRole('button', { name: /Continue to Payment/ }))
  await user.click(screen.getByRole('button', { name: method }))
  return user
}

describe('acceptance checkout paths', () => {
  it('adjusts quantities, removes an item, and preserves the order when returning', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByRole('button', { name: /Brewed Coffee/ }))[0])
    await user.click(screen.getByRole('button', { name: 'Increase Brewed Coffee' }))
    await user.click(screen.getByRole('button', { name: /Club Sandwich/ }))
    await user.click(screen.getByRole('button', { name: /Soft Drink/ }))
    expect(screen.getByText('₱175.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Increase Brewed Coffee' }))
    expect(screen.getByText('₱220.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Decrease Brewed Coffee' }))
    await user.click(screen.getAllByRole('button', { name: 'Remove' })[2])
    expect(screen.getByText('₱140.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Review Order/ }))
    await user.click(screen.getByRole('button', { name: /Back to menu/ }))
    expect(screen.getByLabelText('Brewed Coffee quantity')).toHaveTextContent('2')
    expect(screen.getByText('₱140.00')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Review Order/ }))
    await user.click(screen.getByRole('button', { name: /Continue to Payment/ }))
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.type(screen.getByLabelText('Amount paid'), '200')
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))
    await user.click(await screen.findByRole('button', { name: /View Receipt/ }))
    expect(screen.getByText('₱60.00')).toBeInTheDocument()
  })

  it.each(['QR Payment', 'Credit/Debit Card'])('completes %s with zero change and resets', async (method) => {
    const user = await openPayment(method)
    await user.click(screen.getByRole('button', { name: method === 'QR Payment' ? 'Confirm Payment' : 'Process Payment' }))
    if (method === 'Credit/Debit Card') expect(screen.getByRole('button', { name: 'Processing…' })).toBeDisabled()
    await user.click(await screen.findByRole('button', { name: /View Receipt/ }, { timeout: 3000 }))
    expect(screen.getByText(method)).toBeInTheDocument()
    expect(screen.getByText('₱0.00')).toBeInTheDocument()
    const saved = JSON.parse(localStorage.getItem('campus-pos-transactions')!)
    expect(saved).toHaveLength(1)
    expect(saved[0]).toMatchObject({ total: 4500, amountPaid: 4500, change: 0, paymentMethod: method })
    await user.click(screen.getByRole('button', { name: /Start New Transaction/ }))
    expect(screen.getByText('Your order is empty')).toBeInTheDocument()
  })

  it('accepts exact cash with zero change', async () => {
    const user = await openPayment('Cash')
    await user.type(screen.getByLabelText('Amount paid'), '45')
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))
    await user.click(await screen.findByRole('button', { name: /View Receipt/ }))
    expect(screen.getByText('₱0.00')).toBeInTheDocument()
  })

  it('does not create a receipt for blank payment', async () => {
    const user = await openPayment('Cash')
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))
    expect(screen.getByRole('alert')).toHaveTextContent('Enter the amount paid.')
    expect(localStorage.getItem('campus-pos-transactions')).toBeNull()
  })

  it('reuses the transaction ID after an uncertain save failure', async () => {
    const save = vi.spyOn(transactionRepository, 'save').mockRejectedValueOnce(new Error('Network failure')).mockResolvedValueOnce()
    const user = await openPayment('QR Payment')
    await user.click(screen.getByRole('button', { name: 'Confirm Payment' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Payment could not be saved')
    expect(screen.queryByRole('button', { name: /View Receipt/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm Payment' }))
    expect(await screen.findByRole('button', { name: /View Receipt/ })).toBeInTheDocument()
    expect(save.mock.calls[1][0]).toEqual(save.mock.calls[0][0])
  })
})


describe('touchscreen navigation', () => {
  it('filters categories without losing the cart and resets the filter for a new customer', async () => {
    const user = userEvent.setup()
    render(<App />)
    await user.click((await screen.findAllByRole('button', { name: /Brewed Coffee/ }))[0])
    await user.click(screen.getByRole('button', { name: 'Snacks' }))
    expect(screen.queryByRole('button', { name: /Brewed Coffee.*Tap to add/ })).not.toBeInTheDocument()
    expect(screen.getByLabelText('Brewed Coffee quantity')).toHaveTextContent('1')
    await user.click(screen.getByRole('button', { name: /Review Order/ }))
    expect(screen.getByRole('heading', { name: 'Review your order' })).toHaveFocus()
    await user.click(screen.getByRole('button', { name: /Back to menu/ }))
    expect(screen.getByRole('button', { name: 'Snacks' })).toHaveAttribute('aria-pressed', 'true')
    await user.click(screen.getByRole('button', { name: /Review Order/ }))
    await user.click(screen.getByRole('button', { name: /Continue to Payment/ }))
    await user.click(screen.getByRole('button', { name: 'Cash' }))
    await user.click(screen.getByRole('button', { name: 'Exact amount' }))
    expect(screen.getByLabelText('Amount paid')).toHaveValue(45)
    await user.click(screen.getByRole('button', { name: 'Pay Now' }))
    await user.click(await screen.findByRole('button', { name: /View Receipt/ }))
    await user.click(screen.getByRole('button', { name: /Start New Transaction/ }))
    expect(screen.getByRole('button', { name: 'All items' })).toHaveAttribute('aria-pressed', 'true')
    expect(screen.getByText('Your order is empty')).toBeInTheDocument()
  })
})


it('offers eight products and gives separate references to consecutive customers', async () => {
  const user = userEvent.setup()
  render(<App />)
  await screen.findAllByRole('button', { name: /Brewed Coffee/ })
  expect(document.querySelectorAll('.product-card')).toHaveLength(8)
  const references: string[] = []
  for (let customer = 0; customer < 2; customer++) {
    await user.click(screen.getByRole('button', { name: /Brewed Coffee/ }))
    expect(screen.getByText('Brewed Coffee added to your order.')).toHaveAttribute('role', 'status')
    await user.click(screen.getByRole('button', { name: /Review Order/ }))
    await user.click(screen.getByRole('button', { name: /Continue to Payment/ }))
    await user.click(screen.getByRole('button', { name: 'QR Payment' }))
    expect(screen.getByText('Scan the QR code using your supported payment application')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Confirm Payment' }))
    expect(await screen.findByText('PAYMENT SUCCESSFUL')).toBeInTheDocument()
    references.push(screen.getByText(/^TXN-/).textContent!)
    await user.click(screen.getByRole('button', { name: /View Receipt/ }))
    expect(screen.getByText('Payment Successful')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: /Start New Transaction/ }))
    expect(screen.queryByText(/^TXN-/)).not.toBeInTheDocument()
    expect(screen.getByText('Your order is empty')).toBeInTheDocument()
  }
  expect(references[0]).not.toBe(references[1])
  expect(JSON.parse(localStorage.getItem('campus-pos-transactions')!)).toHaveLength(2)
})
