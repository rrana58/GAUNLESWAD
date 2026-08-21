import { formatNpr, cn } from '@/lib/utils'


const STATUS_LABELS = {
  pending: { label: 'Pending confirmation', style: 'bg-muted text-muted-foreground' },
  active: { label: 'Active', style: 'bg-accent text-accent-foreground' },
  paused: { label: 'Paused', style: 'bg-secondary/20 text-secondary-foreground' },
}

export default function SubscriptionStatusCard({ subscription, summary }) {
  const status = STATUS_LABELS[subscription.status] || STATUS_LABELS.pending

  return (
    <div
      className="border border-border bg-card p-4 flex flex-col gap-3"
      style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      role="region"
      aria-label={`${subscription.plan.name} subscription — ${status.label}`}
    >
      <div className="flex items-center justify-between">
        <h3 className="font-display text-lg text-foreground">{subscription.plan.name}</h3>
        <span
          className={cn('text-[11px] font-medium px-2 py-0.5', status.style)}
          style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
          aria-label={`Subscription status: ${status.label}`}
        >
          {status.label}
        </span>
      </div>

      {subscription.status === 'pending' && (
        <p className="text-sm text-muted-foreground">
          We'll activate your plan once your payment is confirmed. This usually takes a few hours.
        </p>
      )}

      {subscription.status !== 'pending' && (
        <dl
          role="list"
          aria-label="Subscription usage summary"
          className="grid grid-cols-3 gap-2 text-center"
        >
          <div role="listitem">
            <p
              className="font-mono text-lg font-semibold text-primary"
              aria-label={`Meals remaining: ${summary.mealsRemaining}`}
            >
              {summary.mealsRemaining}
            </p>
            <p className="text-[10px] text-muted-foreground" aria-hidden="true">Meals left</p>
          </div>
          <div role="listitem">
            <p
              className="font-mono text-lg font-semibold text-foreground"
              aria-label={`Meals used: ${summary.mealsUsed}`}
            >
              {summary.mealsUsed}
            </p>
            <p className="text-[10px] text-muted-foreground" aria-hidden="true">Used</p>
          </div>
          <div role="listitem">
            <p
              className="font-mono text-lg font-semibold text-foreground"
              aria-label={`Days remaining: ${summary.daysRemaining ?? 'unknown'}`}
            >
              {summary.daysRemaining ?? '—'}
            </p>
            <p className="text-[10px] text-muted-foreground" aria-hidden="true">Days left</p>
          </div>
        </dl>
      )}

      {subscription.status === 'active' && (
        <p className="text-xs text-muted-foreground">
          {summary.canUseMeals
            ? 'You can redeem your remaining meals at any time by adding eligible items to your cart.'
            : "You've used all your meals for this period."}
        </p>
      )}

      <p
        className="text-xs text-muted-foreground"
        aria-label={`Amount paid: ${formatNpr(subscription.pricePaid)}`}
      >
        Paid {formatNpr(subscription.pricePaid)}
      </p>
    </div>
  )
}