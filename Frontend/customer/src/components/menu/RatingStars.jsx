import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

/**
 * RatingStars — Design System: Phase 4.3 Product Detail Migration
 *
 * Changes:
 *  - Added aria-label so screen readers announce the rating value
 *  - Added role="img" to the container so it's treated as a single image, not 5 separate icons
 *  - Individual stars: aria-hidden="true" (meaning conveyed by the container label)
 *  - Tailwind tokens (fill-secondary, text-secondary, text-border) retained — correct ✅
 */
export default function RatingStars({ value = 0, size = 14, className }) {
  const rounded = Math.round(value)
  return (
    <div
      className={cn('flex items-center gap-0.5', className)}
      role="img"
      aria-label={`Rating: ${value.toFixed(1)} out of 5 stars`}
    >
      {Array.from({ length: 5 }).map((_, i) => (
        <Star
          key={i}
          size={size}
          aria-hidden="true"
          className={i < rounded ? 'fill-secondary text-secondary' : 'text-border'}
        />
      ))}
    </div>
  )
}