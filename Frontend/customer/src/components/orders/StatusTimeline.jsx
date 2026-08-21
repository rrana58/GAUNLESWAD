import { Check } from 'lucide-react'
import { cn } from '@/lib/utils'


const STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered']
const LABELS = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
}

export default function StatusTimeline({ status }) {
  if (status === 'cancelled' || status === 'refunded') {
    return (
      <div
        className="bg-destructive/10 border border-destructive/30 px-4 py-3"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        role="status"
        aria-label={`Order ${status}`}
      >
        <p className="text-sm font-medium text-destructive capitalize">{status}</p>
      </div>
    )
  }

  const currentIndex = STEPS.indexOf(status)

  return (
    <ol
      role="list"
      aria-label={`Order progress: currently ${LABELS[status] || status}`}
      className="flex flex-col gap-0"
    >
      {STEPS.map((step, i) => {
        const done = i <= currentIndex
        const isCurrent = i === currentIndex
        const isLast = i === STEPS.length - 1

        return (
          <li
            key={step}
            role="listitem"
            aria-current={isCurrent ? 'step' : undefined}
            className="flex gap-3"
          >
            {/* Step indicator column */}
            <div className="flex flex-col items-center" aria-hidden="true">
              <div
                className={cn(
                  'h-6 w-6 flex items-center justify-center shrink-0',
                  done ? 'bg-accent text-accent-foreground' : 'bg-muted text-muted-foreground'
                )}
                style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
              >
                {done
                  ? <Check size={13} aria-hidden="true" />
                  : <span className="h-1.5 w-1.5 rounded-full bg-current" aria-hidden="true" />
                }
              </div>
              {!isLast && (
                <div
                  className={cn('w-0.5 flex-1 min-h-6', done ? 'bg-accent' : 'bg-border')}
                  aria-hidden="true"
                />
              )}
            </div>

            {/* Step label */}
            <p
              className={cn(
                'text-sm pb-6',
                done ? 'text-foreground font-medium' : 'text-muted-foreground'
              )}
            >
              {LABELS[step]}
              {isCurrent && <span className="sr-only"> (current step)</span>}
            </p>
          </li>
        )
      })}
    </ol>
  )
}