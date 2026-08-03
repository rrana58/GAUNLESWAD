import { useState, useId } from 'react'
import { toast } from 'sonner'
import { ordersApi } from '@/api/orders'
import { getErrorMessage } from '@/lib/errorMessage'
import StarRating from './StarRating'

/**
 * RateOrderCard — Design System: Phase 4.6 Orders Migration
 *
 * Token changes:
 *  - Card: rounded-lg → var(--gs-radius-lg)
 *  - Textarea: rounded-lg → var(--gs-radius-lg); focus:border-primary → focus-visible:ring-2
 *  - Submit button: rounded-lg → var(--gs-radius-lg) + gs-focus-ring + active:scale
 *
 * Accessibility:
 *  - Food rating: role="group" + aria-labelledby via useId()
 *  - Delivery rating: role="group" + aria-labelledby via useId()
 *  - Textarea: aria-label + id for explicit labeling
 *  - Submit: aria-busy + aria-disabled + descriptive aria-label
 *
 * handleSubmit, ordersApi.rateOrder, onRated callback unchanged.
 */
export default function RateOrderCard({ order, onRated }) {
  const [foodRating, setFoodRating] = useState(0)
  const [deliveryRating, setDeliveryRating] = useState(0)
  const [comment, setComment] = useState('')
  const [submitting, setSubmitting] = useState(false)

  const foodGroupId = useId()
  const deliveryGroupId = useId()
  const commentId = useId()

  const handleSubmit = async () => {
    if (foodRating < 1) {
      toast.error('Please rate the food')
      return
    }
    setSubmitting(true)
    try {
      await ordersApi.rateOrder(order._id, {
        foodRating,
        deliveryRating: deliveryRating || undefined,
        comment: comment.trim() || undefined,
      })
      toast.success('Thanks for your feedback!')
      onRated?.({
        food: foodRating,
        delivery: deliveryRating || undefined,
        comment: comment.trim() || undefined,
      })
    } catch (err) {
      toast.error(getErrorMessage(err, 'Could not submit your rating.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <section
      className="flex flex-col gap-3 border border-border bg-card p-4"
      style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      aria-label="Rate your order"
    >
      <h2 className="font-display text-sm text-foreground">How was your order?</h2>

      {/* Food rating */}
      <div
        role="group"
        aria-labelledby={foodGroupId}
        className="flex flex-col gap-1.5"
      >
        <span id={foodGroupId} className="text-xs text-muted-foreground">Food</span>
        <StarRating value={foodRating} onChange={setFoodRating} />
      </div>

      {/* Delivery rating */}
      <div
        role="group"
        aria-labelledby={deliveryGroupId}
        className="flex flex-col gap-1.5"
      >
        <span id={deliveryGroupId} className="text-xs text-muted-foreground">Delivery (optional)</span>
        <StarRating value={deliveryRating} onChange={setDeliveryRating} />
      </div>

      {/* Comment */}
      <textarea
        id={commentId}
        value={comment}
        onChange={(e) => setComment(e.target.value)}
        placeholder="Anything you'd like to add? (optional)"
        rows={2}
        maxLength={500}
        aria-label="Additional comments (optional)"
        className="w-full border border-border bg-background px-3 py-2 text-sm outline-none resize-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      />

      {/* Submit */}
      <button
        type="button"
        onClick={handleSubmit}
        disabled={submitting || foodRating < 1}
        aria-busy={submitting}
        aria-disabled={submitting || foodRating < 1}
        aria-label={submitting ? 'Submitting your rating...' : 'Submit rating'}
        className="bg-primary text-primary-foreground py-2.5 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform gs-focus-ring"
        style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
      >
        {submitting ? 'Submitting...' : 'Submit rating'}
      </button>
    </section>
  )
}
