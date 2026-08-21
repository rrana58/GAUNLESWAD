import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'


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