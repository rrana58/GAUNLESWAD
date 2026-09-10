import { useMemo } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Minus, Plus, Trash2, ShoppingBag } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import { subscriptionApi } from '@/api/orders'
import { useCartStore, lineKey } from '@/store/cartStore'
import { formatNpr } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'


export default function Cart() {
  const navigate = useNavigate()
  const items = useCartStore((s) => s.items)
  const updateQuantity = useCartStore((s) => s.updateQuantity)
  const removeItem = useCartStore((s) => s.removeItem)
  const subtotal = useCartStore((s) => s.getSubtotal())
  const { isAuthenticated } = useAuthStore()

  const { data: mySubData } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => subscriptionApi.getMySubscription().then((r) => r.data),
    enabled: isAuthenticated,
  })

  const subscriptionDiscount = useMemo(() => {
    if (!mySubData?.subscription || !mySubData?.summary?.canUseMeals) return 0
    const planItems = mySubData.subscription.plan.items.map((i) => i._id || i)
    let remaining = mySubData.summary.mealsRemaining
    let discount = 0

    // Sort items by price descending so highest priced eligible items get discounted first
    const sortedCart = [...items].sort((a, b) => b.price - a.price)

    for (const item of sortedCart) {
      if (planItems.includes(item.menuItemId) && remaining > 0) {
        const freeQty = Math.min(item.quantity, remaining)
        discount += item.price * freeQty
        remaining -= freeQty
      }
    }
    return discount
  }, [items, mySubData])

  const displaySubtotal = Math.max(0, subtotal - subscriptionDiscount)
  const preTaxSubtotal = displaySubtotal / 1.13
  const vatAmount = displaySubtotal - preTaxSubtotal

  // ── Empty state ──────────────────────────────────────────────────────────────
  if (items.length === 0) {
    return (
      <div className="min-h-dvh flex flex-col">
        <PageHeader title="Your cart" showBackButton={false} />
        <main className="flex-1 flex flex-col items-center justify-center gap-3 px-8 text-center">
          <ShoppingBag
            size={40}
            className="text-muted-foreground"
            aria-hidden="true"
          />
          <p className="font-display text-lg text-foreground">Your cart is empty</p>
          <p className="text-sm text-muted-foreground">Add something delicious from the menu.</p>
          <Link
            to="/"
            aria-label="Browse menu to add items"
            className="mt-2 px-5 py-2.5 text-sm font-semibold bg-primary text-primary-foreground active:scale-[0.98] transition-transform gs-focus-ring"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          >
            Browse Menu
          </Link>
        </main>
      </div>
    )
  }

  // ── Cart with items ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader title="Your cart" showBackButton={false} />

      {/* Cart items list */}
      <main className="flex-1 flex flex-col gap-3 px-4 py-4">
        <ol
          role="list"
          aria-label={`${items.length} item${items.length !== 1 ? 's' : ''} in your cart`}
          className="flex flex-col gap-3"
        >
          {items.map((item) => {
            const key = lineKey(item)
            const lineTotal = item.price * item.quantity
            return (
              <li
                key={key}
                role="listitem"
                className="flex gap-3 border border-border bg-card p-3"
                style={{
                  borderRadius: 'var(--gs-radius-lg, 0.75rem)',
                  boxShadow: 'var(--gs-shadow-sm)',
                }}
              >
                {/* Thumbnail */}
                <div
                  className="h-16 w-16 shrink-0 bg-muted overflow-hidden"
                  style={{ borderRadius: 'var(--gs-radius-md, 0.5rem)' }}
                >
                  {item.image ? (
                    <img
                      src={item.image}
                      alt={item.name}
                      className="h-full w-full object-cover"
                    />
                  ) : null}
                </div>

                {/* Item details */}
                <div className="flex-1 min-w-0">
                  <p className="font-display text-sm text-foreground truncate">{item.name}</p>

                  {/* Special instructions */}
                  {item.specialInstructions && (
                    <p className="text-xs text-muted-foreground italic truncate">
                      "{item.specialInstructions}"
                    </p>
                  )}

                  {/* Stepper + price + remove */}
                  <div className="flex items-center justify-between mt-2">
                    {/* Quantity stepper — 44px touch targets */}
                    <div
                      className="flex items-center gap-1 border border-border px-1 py-0.5"
                      style={{ borderRadius: 'var(--gs-radius-md, 0.5rem)' }}
                      role="group"
                      aria-label={`Quantity for ${item.name}`}
                    >
                      <button
                        onClick={() => updateQuantity(key, item.quantity - 1)}
                        className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors gs-focus-ring rounded-[var(--gs-radius-sm,0.25rem)]"
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        <Minus size={14} aria-hidden="true" />
                      </button>
                      <span
                        className="font-mono text-sm w-5 text-center"
                        aria-live="polite"
                        aria-atomic="true"
                        aria-label={`Quantity: ${item.quantity}`}
                      >
                        {item.quantity}
                      </span>
                      <button
                        onClick={() => updateQuantity(key, item.quantity + 1)}
                        className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors gs-focus-ring rounded-[var(--gs-radius-sm,0.25rem)]"
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        <Plus size={14} aria-hidden="true" />
                      </button>
                    </div>

                    {/* Line total + remove */}
                    <div className="flex items-center gap-1">
                      <span
                        className="font-mono text-sm font-semibold text-primary"
                        aria-label={`${item.name} total: ${formatNpr(lineTotal)}`}
                      >
                        {formatNpr(lineTotal)}
                      </span>
                      <button
                        onClick={() => removeItem(key)}
                        className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-destructive transition-colors gs-focus-ring rounded-[var(--gs-radius-sm,0.25rem)]"
                        aria-label={`Remove ${item.name} from cart`}
                      >
                        <Trash2 size={16} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                </div>
              </li>
            )
          })}
        </ol>
      </main>

      {/* Order summary + checkout */}
      <section
        role="region"
        aria-label="Order summary"
        className="border-t border-border bg-card px-4 py-4 flex flex-col gap-3"
        style={{ paddingBottom: 'calc(1rem + env(safe-area-inset-bottom))' }}
      >
        {/* Subtotal row */}
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Subtotal</span>
          <span
            className="font-mono font-semibold text-foreground"
            aria-label={`Subtotal: ${formatNpr(preTaxSubtotal)}`}
          >
            {formatNpr(preTaxSubtotal)}
          </span>
        </div>

        {/* VAT row */}
        <div className="flex items-center justify-between text-sm -mt-2">
          <span className="text-muted-foreground">13% VAT</span>
          <span
            className="font-mono font-semibold text-foreground"
            aria-label={`VAT: ${formatNpr(vatAmount)}`}
          >
            {formatNpr(vatAmount)}
          </span>
        </div>

        {/* Subscription discount row */}
        {subscriptionDiscount > 0 && (
          <div
            className="flex items-center justify-between text-sm text-primary -mt-2"
            role="status"
            aria-label={`Meal plan discount applied: ${formatNpr(subscriptionDiscount)}`}
          >
            <span
              className="flex items-center gap-1.5 font-medium"
            >
              {/* Subscription indicator dot */}
              <span
                className="inline-block h-2 w-2 rounded-full"
                style={{ backgroundColor: 'var(--gs-secondary, #B58A63)' }}
                aria-hidden="true"
              />
              Meal Plan Applied
            </span>
            <span className="font-mono font-semibold">- {formatNpr(subscriptionDiscount)}</span>
          </div>
        )}

        {/* Delivery note */}
        <p className="text-xs text-muted-foreground -mt-1">
          Delivery fee &amp; any discounts calculated at checkout.
        </p>

        {/* Checkout CTA */}
        <button
          onClick={() => navigate('/checkout')}
          aria-label={`Proceed to checkout — Total: ${formatNpr(displaySubtotal)}`}
          className="py-3 text-sm font-semibold bg-primary text-primary-foreground active:scale-[0.98] transition-transform gs-focus-ring"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          Proceed to checkout
        </button>
      </section>
    </div>
  )
}