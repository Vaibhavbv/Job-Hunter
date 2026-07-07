/**
 * Razorpay Checkout integration.
 * The SDK script is loaded on demand the first time a user actually starts
 * a purchase (same lazy pattern as pdfjs-dist in ResumeUpload) — it never
 * touches the initial bundle or non-buying visitors.
 *
 * Payment truth lives server-side: the razorpay-webhook edge function is
 * what actually grants credits/subscriptions. The `onSuccess` callback here
 * only means "the modal reported a captured payment" — callers should
 * refetch entitlements after a short delay rather than granting anything
 * client-side.
 */
import { createCheckoutOrder } from './api'

interface RazorpayHandlerResponse {
  razorpay_payment_id: string
  razorpay_order_id: string
  razorpay_signature: string
}

interface RazorpayCheckoutOptions {
  key: string
  amount: number
  currency: string
  order_id: string
  name: string
  description?: string
  prefill?: { email?: string; name?: string }
  theme?: { color?: string }
  handler?: (response: RazorpayHandlerResponse) => void
  modal?: { ondismiss?: () => void }
}

interface RazorpayInstance {
  open(): void
}

declare global {
  interface Window {
    Razorpay?: new (options: RazorpayCheckoutOptions) => RazorpayInstance
  }
}

let sdkPromise: Promise<void> | null = null

function loadSdk(): Promise<void> {
  if (window.Razorpay) return Promise.resolve()
  if (!sdkPromise) {
    sdkPromise = new Promise((resolve, reject) => {
      const script = document.createElement('script')
      script.src = 'https://checkout.razorpay.com/v1/checkout.js'
      script.onload = () => resolve()
      script.onerror = () => {
        sdkPromise = null // allow retry on transient network failure
        reject(new Error('Failed to load the payment SDK — check your connection'))
      }
      document.head.appendChild(script)
    })
  }
  return sdkPromise
}

export interface OpenCheckoutOptions {
  itemType: 'plan' | 'credit_pack'
  itemId: string
  prefill?: { email?: string; name?: string }
  /** Fired when the modal reports a captured payment. Refetch entitlements
   *  after a short delay — the webhook is the source of truth. */
  onSuccess: () => void
  onDismiss?: () => void
}

/**
 * Create the order server-side and open the Razorpay modal.
 * Resolves once the modal is open; rejects if the order or SDK fails first.
 */
export async function openCheckout(options: OpenCheckoutOptions): Promise<void> {
  const [order] = await Promise.all([
    createCheckoutOrder(options.itemType, options.itemId),
    loadSdk(),
  ])

  if (!window.Razorpay) {
    throw new Error('Payment SDK unavailable')
  }

  const rzp = new window.Razorpay({
    key: order.key_id,
    amount: order.amount,
    currency: order.currency,
    order_id: order.order_id,
    name: 'Job Hunter',
    description: order.item_name,
    prefill: options.prefill,
    theme: { color: '#00ff88' },
    handler: () => options.onSuccess(),
    modal: { ondismiss: options.onDismiss },
  })
  rzp.open()
}
