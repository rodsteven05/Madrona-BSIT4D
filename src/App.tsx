import { useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ProductVisual } from './components/ProductVisual'
import { Icon } from './components/Icon'
import { OrderLines } from './components/OrderLines'
import { loadProducts } from './repositories/products'
import { transactionRepository } from './repositories/transactions'
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
  const [category, setCategory] = useState('All items')
  const [catalogLoading, setCatalogLoading] = useState(true)
  const [catalogError, setCatalogError] = useState(false)
  const [catalogAttempt, setCatalogAttempt] = useState(0)
  const mainRef = useRef<HTMLElement>(null)
  const paymentLock = useRef(false)
  const pendingTransaction = useRef<CompletedTransaction | null>(null)
  useEffect(() => {
    let active = true
    loadProducts().then((catalog) => {
      if (active) { setProducts(catalog); setCatalogLoading(false) }
    }).catch(() => {
      if (active) { setCatalogError(true); setCatalogLoading(false) }
    })
    return () => { active = false }
  }, [catalogAttempt])
  const [cashAmount, setCashAmount] = useState('')
  const [paymentError, setPaymentError] = useState('')
  const [processing, setProcessing] = useState(false)
  const total = useMemo(() => cartTotal(state.cart), [state.cart])
  const itemCount = state.cart.reduce((sum, line) => sum + line.quantity, 0)
  const currentStep = steps.findIndex((step) => step.screens.includes(state.screen))

  const categories = ['All items', ...new Set(products.map((product) => product.category))]
  const visibleProducts = category === 'All items' ? products : products.filter((product) => product.category === category)

  useEffect(() => {
    const heading = mainRef.current?.querySelector('h2')
    if (heading) {
      heading.tabIndex = -1
      heading.focus({ preventScroll: true })
      heading.scrollIntoView?.({ block: 'nearest' })
    }
  }, [state.screen])

  useEffect(() => {
    if (!state.feedback) return
    const timer = window.setTimeout(() => dispatch({ type: 'SET_FEEDBACK', message: '' }), 4000)
    return () => window.clearTimeout(timer)
  }, [state.feedback])

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
    setCategory('All items')
    setCashAmount('')
    setPaymentError('')
    setProcessing(false)
    dispatch({ type: 'RESET' })
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand-mark"><Icon name="cart" /></div>
        <div>
          <p className="eyebrow">SELF-SERVICE KIOSK</p>
          <h1>Campus Store</h1>
        </div>
        <div className="header-note">Fresh picks. Easy checkout.</div>
      </header>

      <nav className="stepper" aria-label="Checkout progress">
        {steps.map((step, index) => (
          <div className={`step ${index === currentStep ? 'active' : ''} ${index < currentStep ? 'done' : ''}`} key={step.label} aria-current={index === currentStep ? 'step' : undefined}>
            <span>{index < currentStep ? '✓' : index + 1}</span><small>{step.label}</small>
          </div>
        ))}
      </nav>

      <main ref={mainRef}>
        {state.screen === 'items' && (
          <div className="selection-layout">
            <section>
              <div className="section-heading">
                <div><p className="eyebrow">GOOD FOOD. GOOD DAY.</p><h2>Pick your favorites.</h2></div>
                <p>Tap any item to add it to your order.</p>
              </div>
              <div className="category-tabs" role="group" aria-label="Product categories">
                {categories.map((name) => <button type="button" key={name} aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>)}
              </div>
              {catalogLoading && <div className="catalog-message" role="status">Loading the menu…</div>}
              {catalogError && <div className="catalog-message" role="alert"><h3>We couldn’t load the menu.</h3><p>Please check the connection and try again.</p><button className="secondary-button" type="button" onClick={() => { setCatalogLoading(true); setCatalogError(false); setCatalogAttempt((attempt) => attempt + 1) }}>Try again</button></div>}
              <div className="product-grid">
                {visibleProducts.map((product) => (
                  <button className="product-card" type="button" key={product.id} onClick={() => dispatch({ type: 'ADD_ITEM', product })}>
                    <ProductVisual key={product.imageUrl ?? product.id} product={product} />
                    <span className="category">{product.category}</span>
                    <strong>{product.name}</strong>
                    <small>{product.description}</small>
                    <span className="product-footer"><b>{formatCurrency(product.price)}</b><small>Tap to add</small></span>
                  </button>
                ))}
              </div>
            </section>

            <aside id="current-order" className="cart-panel">
              <div className="cart-heading"><div><p className="eyebrow">CURRENT ORDER</p><h2>Your cart</h2></div><span>{itemCount} {itemCount === 1 ? 'item' : 'items'}</span></div>
              {state.cart.length ? (
                <OrderLines cart={state.cart} editable onIncrement={(productId) => dispatch({ type: 'INCREMENT', productId })} onDecrement={(productId) => dispatch({ type: 'DECREMENT', productId })} onRemove={(productId) => dispatch({ type: 'REMOVE', productId })} />
              ) : (
                <div className="empty-state"><div className="empty-icon"><Icon name="cart" /></div><h3>Your order is empty</h3><p>Select an item from the menu to get started.</p></div>
              )}
              <div className="cart-footer">
                {!state.cart.length && <p className="cart-hint">Add an item to continue.</p>}
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
                ['Cash', 'cash', 'Pay using Philippine peso bills or coins.'],
                ['QR Payment', 'qr', 'Scan using your supported payment app.'],
                ['Credit/Debit Card', 'card', 'Tap, insert, or swipe your bank card.'],
              ] as [PaymentMethod, string, string][]).map(([method, icon, description]) => (
                <button className="payment-card" type="button" key={method} aria-label={method} onClick={() => dispatch({ type: 'SELECT_METHOD', method })}><span><Icon name={icon} /></span><strong>{method}</strong><small>{description}</small><b>Select →</b></button>
              ))}
            </div>
            <button className="text-button" type="button" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'summary' })}>← Back to order summary</button>
          </section>
        )}

        {state.screen === 'payment' && state.selectedMethod && (
          <section className="centered-screen narrow">
            <div className="screen-title"><p className="eyebrow">{state.selectedMethod.toUpperCase()}</p><h2>Complete your payment</h2></div>
            <div className="payment-box" aria-busy={processing}>
              <div className="due-row"><span>Total due</span><strong>{formatCurrency(total)}</strong></div>
              {state.selectedMethod === 'Cash' && (
                <div className="cash-form"><label htmlFor="cash-amount">Amount paid</label><div className="money-input"><span>₱</span><input id="cash-amount" aria-invalid={Boolean(paymentError)} aria-describedby={paymentError ? "payment-error" : undefined} disabled={processing} inputMode="decimal" type="number" min="0" step="0.01" placeholder="0.00" value={cashAmount} onChange={(event) => setCashAmount(event.target.value)} autoFocus /></div><div className="cash-shortcuts" role="group" aria-label="Quick cash amounts">{[total, ...[20000, 50000, 100000].filter((amount) => amount > total)].slice(0, 4).map((amount, index) => <button type="button" key={amount} disabled={processing} onClick={() => { setCashAmount((amount / 100).toFixed(2)); setPaymentError('') }}>{index === 0 ? 'Exact amount' : formatCurrency(amount)}</button>)}</div>{cashAmount && Number(cashAmount) * 100 >= total && <div className="change-preview"><span>Change</span><strong>{formatCurrency(Math.round(Number(cashAmount) * 100) - total)}</strong></div>}<button className="primary-button" type="button" disabled={processing} onClick={() => completePayment('Cash', cashAmount)}>{processing ? 'Saving payment…' : 'Pay Now'}</button></div>
              )}
              {state.selectedMethod === 'QR Payment' && (
                <div className="simulation"><div className="qr-placeholder" aria-label="QR payment code placeholder"><span>DEMO QR</span></div><h3>Scan to pay</h3><p>Scan the QR code using your supported payment application</p><button className="primary-button" type="button" disabled={processing} onClick={() => completePayment('QR Payment')}>{processing ? 'Confirming…' : 'Confirm Payment'}</button></div>
              )}
              {state.selectedMethod === 'Credit/Debit Card' && (
                <div className="simulation"><div className={`card-reader ${processing ? 'processing' : ''}`}><Icon name="card" /></div><h3>{processing ? 'Processing payment…' : 'Tap, insert, or swipe your card'}</h3><p>Keep your card near the reader until the transaction is complete.</p><button className="primary-button" type="button" disabled={processing} onClick={() => completePayment('Credit/Debit Card')}>{processing ? 'Processing…' : 'Process Payment'}</button></div>
              )}
              {paymentError && <div id="payment-error" className="error-message" role="alert">{paymentError}</div>}
            </div>
            <button className="text-button" type="button" disabled={processing} onClick={() => { setPaymentError(''); dispatch({ type: 'NAVIGATE', screen: 'method' }) }}>← Choose another payment method</button>
          </section>
        )}

        {state.screen === 'success' && state.completedTransaction && (
          <section className="centered-screen narrow">
            <div className="success-mark" aria-hidden="true">✓</div>
            <div className="screen-title"><p className="eyebrow">PAYMENT SUCCESSFUL</p><h2>Thank you for your purchase</h2><p>Your transaction was completed successfully.</p></div>
            <div className="confirmation-card"><div><span>Transaction number</span><strong>{state.completedTransaction.reference}</strong></div><div><span>Payment method</span><strong>{state.completedTransaction.paymentMethod}</strong></div><div><span>Transaction amount</span><strong>{formatCurrency(state.completedTransaction.total)}</strong></div><div><span>Amount paid</span><strong>{formatCurrency(state.completedTransaction.amountPaid)}</strong></div>{state.completedTransaction.paymentMethod === 'Cash' && <div><span>Change</span><strong>{formatCurrency(state.completedTransaction.change)}</strong></div>}</div>
            <button className="primary-button full" type="button" onClick={() => dispatch({ type: 'NAVIGATE', screen: 'receipt' })}>View Receipt <span>→</span></button>
          </section>
        )}

        {state.screen === 'receipt' && state.completedTransaction && (
          <section className="centered-screen receipt-screen">
            <div className="screen-title"><p className="eyebrow">DIGITAL RECEIPT</p><h2>Your receipt</h2></div>
            <article className="receipt">
              <div className="receipt-brand"><div className="brand-mark"><Icon name="cart" /></div><h3>CAMPUS STORE POS</h3><p>Campus Food & Merchandise Outlet</p></div>
              <div className="receipt-meta"><div><span>Transaction No.</span><strong>{state.completedTransaction.reference}</strong></div><div><span>Date</span><strong>{new Intl.DateTimeFormat('en-PH', { dateStyle: 'long', timeStyle: 'short' }).format(new Date(state.completedTransaction.completedAt))}</strong></div></div>
              <div className="receipt-items"><div className="receipt-row header"><span>Item</span><span>Subtotal</span></div>{state.completedTransaction.items.map((item) => <div className="receipt-row" key={item.productId}><span><strong>{item.name}</strong><small>{item.quantity} × {formatCurrency(item.unitPrice)}</small></span><b>{formatCurrency(item.subtotal)}</b></div>)}</div>
              <div className="receipt-totals"><div><span>Total</span><strong>{formatCurrency(state.completedTransaction.total)}</strong></div><div><span>Payment method</span><b>{state.completedTransaction.paymentMethod}</b></div><div><span>Amount paid</span><b>{formatCurrency(state.completedTransaction.amountPaid)}</b></div><div><span>Change</span><b>{formatCurrency(state.completedTransaction.change)}</b></div><div className="status-row"><span>Status</span><b>{state.completedTransaction.status}</b></div></div>
              <p className="receipt-thanks">Thank you. Please come again.</p>
            </article>
            <button className="primary-button" type="button" onClick={startNewTransaction}>Start New Transaction</button>
          </section>
        )}
      </main>
      {state.screen === 'items' && state.cart.length > 0 && <div className="mobile-cart-link"><button type="button" onClick={() => { const cart = document.getElementById('current-order'); cart?.scrollIntoView({ block: 'start' }); const heading = cart?.querySelector('h2'); if (heading) { heading.tabIndex = -1; heading.focus({ preventScroll: true }) } }}>View cart · {itemCount} {itemCount === 1 ? 'item' : 'items'} <span aria-hidden="true">↓</span></button></div>}
      {state.feedback && <div className="toast" role="status" aria-live="polite"><span aria-hidden="true">✓</span>{state.feedback}</div>}
    </div>
  )
}

export default App
