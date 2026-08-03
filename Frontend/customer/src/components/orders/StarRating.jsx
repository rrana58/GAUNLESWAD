import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * StarRating — Design System: Phase 4.6 Orders Migration
 *
 * Token changes:
 *  - Star buttons: p-0.5 → h-11 w-11 (44px WCAG touch targets)
 *
 * Accessibility:
 *  - Wrapper: role="radiogroup" + aria-label
 *  - Each button: aria-pressed (selected state) + gs-focus-ring
 *  - Star icon: aria-hidden="true" (button label carries meaning)
 *
 * Prop interface (value, onChange, size) unchanged.
 */
export default function StarRating({ value, onChange, size = 28 }) {
  return (
    <div
      className="flex gap-1"
      role="radiogroup"
      aria-label="Star rating"
    >
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          onClick={() => onChange(n)}
          aria-label={`${n} star${n > 1 ? 's' : ''}`}
          aria-pressed={n === value}
          className="h-11 w-11 flex items-center justify-center active:scale-95 transition-transform gs-focus-ring rounded-[var(--gs-radius-sm,0.25rem)]"
        >
          <Star
            size={size}
            className={cn(n <= value ? 'fill-secondary text-secondary' : 'fill-transparent text-muted-foreground')}
            aria-hidden="true"
          />
        </button>
      ))}
    </div>
  )
}
