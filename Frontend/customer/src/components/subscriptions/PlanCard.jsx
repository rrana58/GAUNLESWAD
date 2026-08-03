import { useState } from 'react'
import { formatNpr, cn } from '@/lib/utils'
import { Check } from 'lucide-react'

/**
 * PlanCard — Design System: Phase 4.2 Customer Home Migration
 *
 * Changes:
 *  - Card: rounded-lg → var(--gs-radius-xl) for consistent card radius
 *  - Card: added var(--gs-shadow-sm) elevation token
 *  - Package option buttons: added gs-focus-ring
 *  - Subscribe/View Details button: added gs-focus-ring, active:scale-[0.98]
 *  - Subscribe button: rounded-lg → var(--gs-radius-lg)
 *  - Package option: rounded-md → var(--gs-radius-md)
 *  - All Tailwind semantic tokens retained (border-border, bg-card, text-primary,
 *    bg-primary, text-primary-foreground, bg-muted, text-muted-foreground) ✅
 *
 * No subscription logic, option selection, or props changed.
 */
export default function PlanCard({ plan, onSubscribe, disabled, compact = false }) {
  const options = [...(plan.pricingOptions || [])].sort((a, b) => a.meals - b.meals)
  const [selectedOpt, setSelectedOpt] = useState(options[0])

  return (
    <div
      className="border border-border bg-card p-4 flex flex-col gap-3"
      style={{
        borderRadius: 'var(--gs-radius-xl, 1rem)',
        boxShadow: 'var(--gs-shadow-sm)',
      }}
    >
      <div>
        {plan.tag && (
          <span className="inline-block rounded-full bg-secondary/20 text-secondary-foreground text-[10px] font-medium px-2 py-0.5 mb-1.5">
            {plan.tag}
          </span>
        )}
        <h3 className="font-display text-lg text-foreground">{plan.name}</h3>
        {plan.description && !compact && (
          <p className="text-sm text-muted-foreground mt-1">{plan.description}</p>
        )}
        {compact && options.length > 0 && (
          <p className="text-xs font-mono text-primary mt-1.5 font-medium">
            Starting at {formatNpr(options[0].price)}
          </p>
        )}
      </div>

      {/* Pricing options — full card only */}
      {!compact && options.length > 0 && (
        <div className="flex flex-col gap-2 mt-1">
          <label className="text-xs font-semibold text-foreground">Select Package:</label>
          <div className="grid grid-cols-2 gap-2">
            {options.map((opt, i) => (
              <button
                key={i}
                onClick={() => setSelectedOpt(opt)}
                aria-pressed={selectedOpt?.meals === opt.meals}
                aria-label={`${opt.meals} meals for ${formatNpr(opt.price)}`}
                className={cn(
                  'border px-3 py-2 text-left flex flex-col transition-colors gs-focus-ring',
                  'rounded-[var(--gs-radius-md,0.5rem)]',
                  selectedOpt?.meals === opt.meals
                    ? 'border-primary bg-primary/5 ring-1 ring-primary'
                    : 'border-border hover:border-primary/50'
                )}
              >
                <span className="font-display text-sm text-foreground">{opt.meals} Meals</span>
                <span className="font-mono text-xs text-primary font-medium">{formatNpr(opt.price)}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Included items — full card only */}
      {!compact && plan.items?.length > 0 && (
        <div className="flex flex-col gap-1">
          {plan.items.map((item) => (
            <div key={item._id} className="flex items-center gap-1.5 text-xs text-muted-foreground">
              <Check size={12} className="text-accent shrink-0" aria-hidden="true" />
              {item.name}
            </div>
          ))}
        </div>
      )}

      {/* CTA button */}
      <button
        onClick={() => onSubscribe(plan, selectedOpt?.meals)}
        disabled={disabled || (!compact && !selectedOpt)}
        aria-label={compact ? `View ${plan.name} plan details` : `Subscribe to ${plan.name}`}
        className={cn(
          'py-2.5 text-sm font-semibold mt-1 active:scale-[0.98] transition-transform gs-focus-ring',
          'rounded-[var(--gs-radius-lg,0.75rem)]',
          (disabled || (!compact && !selectedOpt))
            ? 'bg-muted text-muted-foreground cursor-not-allowed'
            : 'bg-primary text-primary-foreground cursor-pointer'
        )}
      >
        {compact ? 'View Details' : 'Subscribe'}
      </button>
    </div>
  )
}