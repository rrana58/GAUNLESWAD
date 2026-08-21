import { useState, useId } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { subscriptionApi } from '@/api/orders'
import { useAuthStore } from '@/store/authStore'
import { getErrorMessage } from '@/lib/errorMessage'
import { formatNpr, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import PlanCard from '@/components/subscriptions/PlanCard'
import SubscriptionStatusCard from '@/components/subscriptions/SubscriptionStatusCard'
import { useItemModalStore } from '@/store/itemModalStore'


const PAYMENT_METHODS = [
  { id: 'cash', label: 'Cash (in person)', enabled: true },
  { id: 'bank_transfer', label: 'Bank transfer', enabled: true },
  { id: 'khalti', label: 'Khalti', enabled: false },
  { id: 'esewa', label: 'eSewa', enabled: false },
]

export default function Subscriptions() {
  const { isAuthenticated } = useAuthStore()
  const queryClient = useQueryClient()
  const [confirmingPlan, setConfirmingPlan] = useState(null)
  const [paymentMethod, setPaymentMethod] = useState('cash')
  const [submitting, setSubmitting] = useState(false)
  const openModal = useItemModalStore(s => s.openModal)

  const paymentHeadingId = useId()
  const planSummaryId = useId()
  const mySubHeadingId = useId()
  const plansHeadingId = useId()

  const { data: plans, isLoading: plansLoading } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => subscriptionApi.listPlans().then((r) => r.data.plans),
  })

  const { data: mySubData, isLoading: subLoading } = useQuery({
    queryKey: ['my-subscription'],
    queryFn: () => subscriptionApi.getMySubscription().then((r) => r.data),
    enabled: isAuthenticated,
  })

  const { data: usages } = useQuery({
    queryKey: ['meal-history'],
    queryFn: () => subscriptionApi.getMyMealHistory().then((r) => r.data.usages),
    enabled: isAuthenticated && !!mySubData?.subscription,
  })

  const handleSubscribe = async () => {
    setSubmitting(true)
    try {
      await subscriptionApi.subscribe({
        planId: confirmingPlan.plan._id,
        meals: confirmingPlan.meals,
        payment: { method: paymentMethod },
      })
      toast.success('Subscription requested — activates once payment is confirmed')
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] })
      setConfirmingPlan(null)
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not subscribe. Please try again.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleCancel = async () => {
    try {
      await subscriptionApi.cancelMySubscription()
      toast.success('Subscription cancelled')
      queryClient.invalidateQueries({ queryKey: ['my-subscription'] })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not cancel — active subscriptions need admin support.'))
    }
  }

  // ── Confirmation screen ──────────────────────────────────────────────────────
  if (confirmingPlan) {
    return (
      <div className="min-h-dvh flex flex-col">
        <PageHeader title="Confirm subscription" onBack={() => setConfirmingPlan(null)} />
        <main className="flex-1 px-4 py-4 flex flex-col gap-4">

          {/* Plan summary */}
          <section aria-labelledby={planSummaryId}>
            <h2 id={planSummaryId} className="sr-only">Selected plan</h2>
            <div
              className="border border-border bg-card p-3"
              style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
            >
              <p className="font-display text-base text-foreground">{confirmingPlan.plan.name}</p>
              <p className="text-sm text-muted-foreground mt-1">{confirmingPlan.meals} Meals</p>
              <p
                className="font-mono text-sm text-primary mt-1"
                aria-label={`Price: ${formatNpr(confirmingPlan.plan.pricingOptions?.find(o => o.meals === confirmingPlan.meals)?.price)} per month`}
              >
                {formatNpr(confirmingPlan.plan.pricingOptions?.find(o => o.meals === confirmingPlan.meals)?.price)} / month
              </p>
            </div>
          </section>

          {/* Payment method */}
          <section aria-labelledby={paymentHeadingId}>
            <h2 id={paymentHeadingId} className="font-display text-sm text-foreground mb-2">
              Payment method
            </h2>
            <div
              className="flex flex-col gap-2"
              role="radiogroup"
              aria-labelledby={paymentHeadingId}
            >
              {PAYMENT_METHODS.map((method) => (
                <label
                  key={method.id}
                  className={cn(
                    'flex items-center justify-between border px-3 py-2.5 text-sm',
                    'rounded-[var(--gs-radius-lg,0.75rem)]',
                    !method.enabled && 'opacity-40 pointer-events-none',
                    paymentMethod === method.id ? 'border-primary bg-primary/5' : 'border-border'
                  )}
                >
                  <span className="flex items-center gap-2">
                    <input
                      type="radio"
                      name="subPaymentMethod"
                      checked={paymentMethod === method.id}
                      onChange={() => setPaymentMethod(method.id)}
                      disabled={!method.enabled}
                      className="accent-primary"
                      aria-label={method.label}
                    />
                    {method.label}
                  </span>
                  {!method.enabled && (
                    <span className="text-[11px] text-muted-foreground">Coming soon</span>
                  )}
                </label>
              ))}
            </div>
          </section>

          <p className="text-xs text-muted-foreground">
            Your subscription activates once we confirm your payment — this isn't instant.
          </p>

          <button
            type="button"
            onClick={handleSubscribe}
            disabled={submitting}
            aria-busy={submitting}
            aria-label={submitting ? 'Requesting subscription...' : `Confirm subscription to ${confirmingPlan.plan.name}`}
            className="bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-50 active:scale-[0.98] transition-transform gs-focus-ring"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          >
            {submitting ? 'Requesting...' : 'Confirm subscription'}
          </button>
        </main>
      </div>
    )
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader title="Meal plans" showBackButton={false} />

      <main className="flex-1 px-4 py-4 flex flex-col gap-4" aria-label="Meal plan subscriptions">

        {/* Guest banner */}
        {!isAuthenticated && (
          <div
            className="bg-muted px-4 py-3 text-sm text-muted-foreground"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
            role="status"
            aria-label="Login required to subscribe"
          >
            <Link to="/login" className="text-primary underline font-medium gs-focus-ring rounded-sm">
              Log in
            </Link>{' '}
            to subscribe to a meal plan.
          </div>
        )}

        {/* Loading subscription */}
        {isAuthenticated && subLoading && (
          <div role="status" aria-busy="true" aria-label="Loading your subscription" className="flex flex-col gap-3">
            <div className="gs-skeleton h-28 w-full" style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }} />
            <span className="sr-only">Loading subscription details...</span>
          </div>
        )}

        {/* Active subscription */}
        {isAuthenticated && mySubData?.subscription && (
          <section aria-labelledby={mySubHeadingId}>
            <h2 id={mySubHeadingId} className="sr-only">Your subscription</h2>

            <SubscriptionStatusCard
              subscription={mySubData.subscription}
              summary={mySubData.summary}
            />

            {/* Eligible meals grid */}
            {mySubData.subscription.status === 'active' && mySubData.summary.canUseMeals && (
              <div className="mt-4">
                <h3 className="font-display text-sm text-foreground mb-2">Pick your meals</h3>
                <p className="text-xs text-muted-foreground mb-3">
                  Tap an item to order it — your remaining free meals are applied automatically at checkout.
                </p>
                <ol
                  role="list"
                  aria-label="Eligible meal plan items"
                  className="grid grid-cols-2 gap-3"
                >
                  {mySubData.subscription.plan.items?.map((item) => (
                    <li key={item._id} role="listitem">
                      <button
                        onClick={() => openModal(item._id || item)}
                        aria-label={`Order ${item.name} — eligible for your meal plan`}
                        className="flex flex-col text-left w-full border border-border bg-card overflow-hidden transition-all hover:border-primary active:scale-95 gs-focus-ring"
                        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
                      >
                        <div className="aspect-4/3 bg-muted">
                          {item.image?.url && (
                            <img
                              src={item.image.url}
                              alt={item.name}
                              className="h-full w-full object-cover"
                            />
                          )}
                        </div>
                        <div className="p-2.5">
                          <p className="font-display text-sm text-foreground line-clamp-1">{item.name}</p>
                          <span className="inline-flex items-center gap-1 text-[10px] text-accent font-medium mt-1">
                            Eligible
                          </span>
                        </div>
                      </button>
                    </li>
                  ))}
                </ol>
              </div>
            )}

            {/* No meals left */}
            {mySubData.subscription.status === 'active' && !mySubData.summary.canUseMeals && (
              <p className="text-sm text-muted-foreground mt-3">
                No meals remaining on your plan.
              </p>
            )}

            {/* Cancel pending subscription */}
            {mySubData.subscription.status === 'pending' && (
              <button
                type="button"
                onClick={handleCancel}
                aria-label="Cancel subscription request"
                className="mt-3 w-full border border-destructive text-destructive py-2.5 text-sm font-medium active:scale-[0.98] transition-transform gs-focus-ring"
                style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              >
                Cancel request
              </button>
            )}

            {/* Meal usage history */}
            {usages?.length > 0 && (
              <div className="mt-4">
                <h3 className="font-display text-sm text-foreground mb-2">Recent meals</h3>
                <ol role="list" aria-label="Recent meal usage history" className="flex flex-col gap-2">
                  {usages.slice(0, 10).map((u, i) => (
                    <li key={i} role="listitem" className="flex justify-between text-sm border-b border-border pb-2">
                      <span className="text-foreground">{u.menuItem?.name || 'Meal'}</span>
                      <span className="text-muted-foreground">{u.usageDate}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </section>
        )}

        {/* Available plans */}
        <section aria-labelledby={plansHeadingId}>
          <h2
            id={plansHeadingId}
            className="font-display text-sm text-foreground mt-4 border-t border-border pt-4"
          >
            Available plans
          </h2>

          {/* Loading plans */}
          {plansLoading && (
            <div role="status" aria-busy="true" aria-label="Loading meal plans" className="flex flex-col gap-3 mt-3">
              <div className="gs-skeleton h-32 w-full" style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }} />
              <span className="sr-only">Loading plans...</span>
            </div>
          )}

          <div className="flex flex-col gap-3 mt-3">
            {plans?.map((plan) => (
              <PlanCard
                key={plan._id}
                plan={plan}
                disabled={!isAuthenticated}
                onSubscribe={(p, meals) => (isAuthenticated ? setConfirmingPlan({ plan: p, meals }) : null)}
              />
            ))}
          </div>
        </section>
      </main>
    </div>
  )
}