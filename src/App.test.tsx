import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { beforeEach, describe, expect, it } from 'vitest'
import App from './App'

beforeEach(() => localStorage.clear())

describe('complete cash checkout', () => {
  it('rejects insufficient cash then creates a correct receipt and resets', async () => {
    const user = userEvent.setup()
    render(<App />)

    await user.click(screen.getAllByRole('button', { name: /Brewed Coffee/ })[0])
    await user.click(screen.getAllByRole('button', { name: /Brewed Coffee/ })[0])
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
