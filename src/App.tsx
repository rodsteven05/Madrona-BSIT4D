import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { OrderLines } from './components/OrderLines'
import { loadProducts } from './repositories/products'
import { persistenceLabel, transactionRepository } from './repositories/transactions'
import { initialState, posReducer } from './state/posReducer'
import type { CompletedTransaction, PaymentMethod, Product } from './types'
import { cartTotal, createReference, formatCurrency, paidAmountFor, toTransactionLines, validateCash } from './utils/pos'

const steps = [
  { screens: ['items'], label: 'Choose items' },
  { screens: ['summary'], label: 'Review order' },
  { screens: ['method', 'payment'], label: 'Payment' },
  { screens: ['success', 'receipt'], label: 'Receipt' },
]

function App() {
  const [state, dispatch] = useReducer(posReducer, initialState)
  const [products, setProducts] = useState<Product[]>([])
  const paymentLock = useRef(false)
  const pendingTransaction = useRef<CompletedTransaction | null>(null)
  useEffect(() => {
    let active = true
    loadProducts().then((catalog) => { if (active) setProducts(catalog) }).catch(() => {
      if (active) dispatch({ type: 'SET_FEEDBACK', message: 'Products could not be loaded. Check the database configuration and reload.' })
    })
    return () => { active = false }
  }, [])
  const [cashAmount, setCashAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [processing, setProcessing] = useState(false)
  const total = useMemo(() => cartTotal(state.cart), [state.cart])
  const itemCount = state.cart.reduce((sum, line) => sum + line.quantity, 0)
  const currentStep = steps.findIndex((step) => step.screens.includes(state.screen))

  const navigateToSummary = () => {
    if (!state.cart.length) {
      dispatch({ type: 'SET_FEEDBACK', message: 'Add at least one product before continuing.' })
      return
    }
    dispatch({ type: 'NAVIGATE', screen: 'summary' })
  }

  const completePayment = async (method: PaymentMethod, rawCash = '') => {
    if (paymentLock.current || !state.cart.length) return
    if (method === 'Cash') {
      const error = validateCash(rawCash, total)
      if (error) {
        setPaymentError(error)
        return
      }
    }
    paymentLock.current = true
    setPaymentError('')
    setProcessing(true)
    if (method === 'Credit/Debit Card') await new Promise((resolve) => window.setTimeout(resolve, 1200))
    const amountPaid = paidAmountFor(method, total, rawCash)
    const previous = pendingTransaction.current
    const items = toTransactionLines(state.cart)
    const isRetry = previous && previous.paymentMethod === method
      && previous.amountPaid === amountPaid && previous.total === total
      && JSON.stringify(previous.items) === JSON.stringify(items)
    const transaction: CompletedTransaction = isRetry ? previous : {
      id: crypto.randomUUID(),
      reference: createReference(),
      completedAt: new Date().toISOString(),
      items,
      total,
      paymentMethod: method,
      amountPaid,
      change: amountPaid - total,
      status: 'Payment Successful',
    }
    pendingTransaction.current = transaction
    try {
      await transactionRepository.save(transaction)
      dispatch({ type: 'COMPLETE', transaction })
    } catch {
      setPaymentError('Payment could not be saved. Please check the connection and try again.')
    } finally {
      paymentLock.current = false
      setProcessing(false)
    }
  }

  const startNewTransaction = () => {
    pendingTransaction.current = null
    setCashAmount('')
    setPaymentError('')
    setProcessing(false)
    dispatch({ type: 'RESET' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark">CS</div>
        <div>
          <p className="eyebrow">SELF-SERVICE KIOSK</p>
          <h1>Campus Store</h1>
        </div>
        <div className="status-pill"><span />{persistenceLabel}</div>
      </header>

      <nav className="stepper" aria-label="Checkout progress">
        {steps.map((step, index) => (
          <div className={`step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'done' : ''}`} key={step.label}>
            <span>{index + 1}</span><small>{step.label}</small>
          </div>
        ))}
      </nav>

      <main>
        {state.screen === 'items' && (
          <div className="selection-layout">
            <section>
              <div className="section-heading">
                <div><p className="eyebrow">OUR MENU</p><h2>What can we get you?</h2></div>
                <p>Tap any item to add it to your order.</p>
              </div>
              <div className="product-grid">
                {products.map((product) => (
                  <button className="product-card" type="button" key={product.id} onClick={() => dispatch({ type: 'ADD_ITEM', product })}>
                    <span className="product-visual" style={{ background: product.accent }}>{product.initials}</span>
                    <span className="category">{product.category}</span>
                    <strong>{product.name}</strong>
                    <small>{product.description}</small>
                    <span className="product-footer"><b>{formatCurrency(product.price)}</b><i aria-hidden="true">+</i></span>
                  </button>
                ))}
              </div>
            </section>

            <aside className="cart-panel">
              <div className="cart-heading"><div><p className="eyebrow">CURRENT ORDER</p><h2>Your cart</h2></div><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span></div>
              {state.cart.length ? (
                <OrderLines cart={state.cart} editable onIncrement={(productId) => dispatch({ type: 'INCREMENT', productId })} onDecrement={(productId) => dispatch({ type: 'DECREMENT', productId })} onRemove={(productId) => dispatch({ type: 'REMOVE', productId })} />
              ) : (
                <div className="empty-state"><div className="empty-icon">0</div><h3>Your order is empty</h3><p>Select an item from the menu to get started.</p></div>
              )}
              <div className="cart-footer">
                <div className="total-row"><span>Total</span><strong>{formatCurrency(total)}</strong></div>
                <button className="primary-button" type="button" onClick={navigateToSummary} disabled={!state.cart.length}>Review Order <span>→</span></button>
              </div>
            </aside>
          </div>
        )}

        {state.screen === 'summary' && (
          <section className="centered-screen">
            <div className="screen-title"><p className="eyebrow">STEP 2 OF 4</p><h2>Review your order</h2><p>Please check your items before continuing to payment.</p></div>
            <div className="summary-card">
              <div className="table-head"><span>Item</span><span>Quantity</span><span>Subtotal</span></div>
              <OrderLines cart={state.cart} />
              <div className="summary-total"><span>Total amount</span><strong>{formatCurrency(total)}</strong></div>
            </div>
            <div className="button-row"><button className="secondary-button" type="button" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'items' })}>← Back to menu</button><button className="primary-button" type="button" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'method' })}>Continue to Payment <span>→</span></button></div>
          </section>
        )}

        {state.screen === 'method' && (
          <section className="centered-screen">
            <div className="screen-title"><p className="eyebrow">STEP 3 OF 4</p><h2>How would you like to pay?</h2><p>Select one of the available payment methods.</p></div>
            <div className="amount-banner"><span>Amount due</span><strong>{formatCurrency(total)}</strong></div>
            <div className="payment-grid">
              {([
                ['Cash', 'CA', 'Pay using Philippine peso bills or coins.'],
                ['QR Payment', 'QR', 'Scan using your supported payment app.'],
                ['Credit/Debit Card', 'CC', 'Tap, insert, or swipe your bank card.'],
              ] as [PaymentMethod, string, string][]).map(([method, icon, description]) => (
                <button className="payment-card" type="button" key={method} aria-label={method} onClick={() => dispatch({ type: 'SELECT_METHOD', method })}><span>{icon}</span><strong>{method}</strong><small>{description}</small><b>Select →</b></button>
              ))}
            </div>
            <button className="text-button" type="button" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'summary' })}>← Back to order summary</button>
          </section>
        )}

        {state.screen === 'payment' && state.selectedMethod && (
          <section className="centered-screen narrow">
            <div className="screen-title"><p className="eyebrow">{state.selectedMethod.toUpperCase()}</p><h2>Complete your payment</h2></div>
            <div className="payment-box">
              <div className="due-row"><span>Total due</span><strong>{formatCurrency(total)}</strong></div>
              {state.selectedMethod === 'Cash' && (
                <div className="cash-form"><label htmlFor="cash-amount">Amount paid</label><div className="money-input"><span>₱</span><input id="cash-amount" inputMode="decimal" type="number" min="0" step="0.01" placeholder="0.00" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} autoFocus /></div>{cashAmount && Number(cashAmount) * 100 >= total && <div className="change-preview"><span>Change</span><strong>{formatCurrency(Math.round(Number(cashAmount) * 100) - total)}</strong></div>}<button className="primary-button" type="button" disabled={processing} onClick={() => completePayment('Cash', cashAmount)}>Pay Now</button></div>
              )}
              {state.selectedMethod === 'QR Payment' && (
                <div className="simulation"><div className="qr-placeholder" aria-label="QR payment code placeholder"><span>SCAN</span></div><h3>Scan to pay</h3><p>Scan the QR code using your supported payment application, then confirm below.</p><button className="primary-button" type="button" disabled={processing} onClick={() => completePayment('QR Payment')}>{processing ? 'Confirming…' : 'Confirm Payment'}</button></div>
              )}
              {state.selectedMethod === 'Credit/Debit Card' && (
                <div className="simulation"><div className={`card-reader ${processing ? 'processing' : ''}`}>CARD</div><h3>{processing ? 'Processing payment…' : 'Tap, insert, or swipe your card'}</h3><p>Keep your card near the reader until the transaction is complete.</p><button className="primary-button" type="button" disabled={processing} onClick={() => completePayment('Credit/Debit Card')}>{processing ? 'Processing…' : 'Process Payment'}</button></div>
              )}
              {paymentError && <div className="error-message" role="alert">{paymentError}</div>}
            </div>
            <button className="text-button" type="button" disabled={processing} onClick={() => { setPaymentError(''); dispatch({ type: 'NAVIGATE', screen: 'method' }) }}>← Choose another payment method</button>
          </section>
        )}

        {state.screen === 'success' && state.completedTransaction && (
          <section className="centered-screen narrow">
            <div className="success-mark">✓</div>
            <div className="screen-title"><p className="eyebrow">PAYMENT COMPLETE</p><h2>Thank you for your purchase</h2><p>Your transaction was completed successfully.</p></div>
            <div className="confirmation-card"><div><span>Transaction number</span><strong>{state.completedTransaction.reference}</strong></div><div><span>Payment method</span><strong>{state.completedTransaction.paymentMethod}</strong></div><div><span>Transaction amount</span><strong>{formatCurrency(state.completedTransaction.total)}</strong></div><div><span>Amount paid</span><strong>{formatCurrency(state.completedTransaction.amountPaid)}</strong></div>{state.completedTransaction.paymentMethod === 'Cash' && <div><span>Change</span><strong>{formatCurrency(state.completedTransaction.change)}</strong></div>}</div>
            <button className="primary-button full" type="button" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'receipt' })}>View Receipt <span>→</span></button>
          </section>
        )}

        {state.screen === 'receipt' && state.completedTransaction && (
          <section className="centered-screen receipt-screen">
            <div className="screen-title"><p className="eyebrow">DIGITAL RECEIPT</p><h2>Your receipt</h2></div>
            <article className="receipt">
              <div className="receipt-brand"><div className="brand-mark">CS</div><h3>CAMPUS STORE POS</h3><p>Campus Food & Merchandise Outlet</p></div>
              <div className="receipt-meta"><div><span>Transaction No.</span><strong>{state.completedTransaction.reference}</strong></div><div><span>Date</span><strong>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(state.completedTransaction.completedAt))}</strong></div></div>
              <div className="receipt-items"><div className="receipt-row header"><span>Item</span><span>Subtotal</span></div>{state.completedTransaction.items.map((item) => <div className="receipt-row" key={item.productId}><span><strong>{item.name}</strong><small>{item.quantity} × {formatCurrency(item.unitPrice)}</small></span><b>{formatCurrency(item.subtotal)}</b></div>)}</div>
              <div className="receipt-totals"><div><span>Total</span><strong>{formatCurrency(state.completedTransaction.total)}</strong></div><div><span>Payment method</span><b>{state.completedTransaction.paymentMethod}</b></div><div><span>Amount paid</span><b>{formatCurrency(state.completedTransaction.amountPaid)}</b></div><div><span>Change</span><b>{formatCurrency(state.completedTransaction.change)}</b></div><div className="status-row"><span>Status</span><b>{state.completedTransaction.status}</b></div></div>
              <p className="receipt-thanks">Thank you. Please come again.</p>
            </article>
            <button className="primary-button" type="button" onClick={startNewTransaction}>Start New Transaction</button>
          </section>
        )}
      </main>
      {state.feedback && <div className="toast" role="status" aria-live="polite">{state.feedback}</div>}
    </div>
  )
}

export default App
