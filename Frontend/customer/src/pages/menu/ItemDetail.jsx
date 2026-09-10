import { useMemo, useState } from 'react'
import { useParams, useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { ChevronLeft, Leaf, Flame, Minus, Plus } from 'lucide-react'
import { menuApi } from '@/api/menu'
import { useCartStore } from '@/store/cartStore'
import { formatNpr, cn } from '@/lib/utils'
import RatingStars from '@/components/menu/RatingStars'


export default function ItemDetail() {
  const { id } = useParams()
  const navigate = useNavigate()
  const addItem = useCartStore((s) => s.addItem)

  const { data: item, isLoading } = useQuery({
    queryKey: ['menu-item', id],
    queryFn: () => menuApi.getItem(id).then((r) => r.data.item),
  })

  const { data: reviews } = useQuery({
    queryKey: ['reviews', id],
    queryFn: () => menuApi.getReviews(id).then((r) => r.data.reviews),
  })

  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')

  const unitPrice = useMemo(() => {
    return item?.discountedPrice ?? item?.basePrice ?? 0
  }, [item])

  const handleAddToCart = () => {
    addItem({
      menuItemId: item._id,
      name: item.name,
      price: unitPrice,
      image: item.image?.url,
      quantity,
      specialInstructions: notes.trim() || undefined,
    })
    toast.success(`${item.name} added to cart`)
    navigate(-1)
  }

  // --- Loading state ---
  if (isLoading) {
    return (
      <div className="p-4 space-y-4" aria-busy="true" aria-label="Loading item details">
        <div className="aspect-4/3 gs-skeleton rounded-[var(--gs-radius-lg,0.75rem)]" />
        <div className="h-6 w-2/3 gs-skeleton rounded-[var(--gs-radius-md,0.5rem)]" />
        <div className="h-4 w-full gs-skeleton rounded-[var(--gs-radius-md,0.5rem)]" />
      </div>
    )
  }

  // --- Empty state ---
  if (!item) {
    return (
      <div className="p-8 text-center text-muted-foreground" role="status">
        Item not found.
      </div>
    )
  }

  const isOutOfStock = item.stockQuantity != null && item.stockQuantity <= 0

  return (
    <div className="pb-28">
      {/* Hero image + back button */}
      <div className="relative aspect-4/3 bg-muted">
        {item.image?.url ? (
          <img src={item.image.url} alt={item.name} className="h-full w-full object-cover" />
        ) : (
          <div className="h-full w-full flex items-center justify-center text-muted-foreground text-sm">
            No image
          </div>
        )}
        <button
          onClick={() => navigate(-1)}
          className="absolute top-3 left-3 h-9 w-9 rounded-full flex items-center justify-center gs-focus-ring"
          style={{
            backgroundColor: 'rgba(250, 248, 245, 0.92)',
            boxShadow: 'var(--gs-shadow-md)',
          }}
          aria-label="Go back to menu"
        >
          <ChevronLeft size={20} className="text-foreground" aria-hidden="true" />
        </button>
      </div>

      <div className="px-4 pt-4">
        {/* Title + dietary badges */}
        <div className="flex items-start justify-between gap-3">
          <h1 className="font-display text-xl text-foreground">{item.name}</h1>
          <div className="flex gap-1 shrink-0 pt-1">
            {item.isVeg && (
              <span aria-label="Vegetarian" title="Vegetarian">
                <Leaf size={16} className="text-accent" aria-hidden="true" />
              </span>
            )}
            {item.isSpicy && (
              <span aria-label="Spicy" title="Spicy">
                <Flame size={16} className="text-destructive" aria-hidden="true" />
              </span>
            )}
          </div>
        </div>

        {/* Rating */}
        {item.avgRating > 0 && (
          <div className="flex items-center gap-1.5 mt-1">
            <RatingStars value={item.avgRating} />
            <span className="text-xs text-muted-foreground">
              {item.avgRating.toFixed(1)} ({item.totalReviews} reviews)
            </span>
          </div>
        )}

        {/* Description */}
        {item.description && (
          <p className="text-sm text-muted-foreground mt-2">{item.description}</p>
        )}

        {/* Allergens */}
        {item.allergens?.length > 0 && (
          <p
            className="text-xs text-muted-foreground mt-2 bg-muted px-2.5 py-1 w-max font-medium"
            style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
          >
            Contains: {item.allergens.join(', ')}
          </p>
        )}

        {/* Out of stock */}
        {isOutOfStock && (
          <p className="mt-3 text-sm font-medium text-destructive" role="alert">
            Currently out of stock.
          </p>
        )}

        {/* Combo items */}
        {item.isCombo && item.comboItems?.length > 0 && (
          <div
            className="mt-5 bg-primary/5 border border-primary/20 p-4"
            style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
          >
            <h2 className="font-display text-sm font-bold text-foreground mb-3">
              <span aria-hidden="true">🍱</span> What's Included in this Combo
            </h2>
            <div className="flex flex-col gap-3">
              {item.comboItems.map((ci, idx) => (
                <div key={idx} className="flex items-center gap-3">
                  {ci.item?.image?.url ? (
                    <img
                      src={ci.item.image.url}
                      alt={ci.item.name}
                      className="w-12 h-12 object-cover"
                      style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
                    />
                  ) : (
                    <div
                      className="w-12 h-12 flex items-center justify-center text-xs"
                      style={{
                        borderRadius: 'var(--gs-radius-lg, 0.75rem)',
                        backgroundColor: 'var(--gs-surface, #FFFFFF)',
                        boxShadow: 'var(--gs-shadow-sm)',
                      }}
                      aria-hidden="true"
                    >
                      🍽️
                    </div>
                  )}
                  <div className="flex-1">
                    <p className="text-sm font-semibold text-foreground">{ci.item?.name || 'Item'}</p>
                    <p className="text-xs text-muted-foreground">Quantity: {ci.quantity}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Special instructions */}
        <div className="mt-5">
          <h2 className="font-display text-sm text-foreground mb-2">
            <label htmlFor="page-special-instructions">Special instructions</label>
          </h2>
          <textarea
            name="specialInstructions"
            id="page-special-instructions"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="E.g. less spicy, no onions..."
            rows={2}
            className="w-full border border-border bg-card px-3 py-2 text-sm outline-none resize-none transition-colors placeholder:text-muted-foreground focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          />
        </div>

        {/* Reviews */}
        {reviews?.length > 0 && (
          <div className="mt-6">
            <h2 className="font-display text-sm text-foreground mb-2">Reviews</h2>
            <div className="flex flex-col gap-3" role="list" aria-label="Customer reviews">
              {reviews.map((r) => (
                <div key={r._id} className="border-b border-border pb-3" role="listitem">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">{r.customer?.name || 'Customer'}</span>
                    <RatingStars value={r.foodRating} size={12} />
                  </div>
                  {r.comment && (
                    <p className="text-sm text-muted-foreground mt-1">{r.comment}</p>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Fixed bottom action bar */}
      <div
        className="fixed bottom-0 inset-x-0 bg-card border-t border-border px-4 py-3 flex items-center gap-3"
        style={{
          zIndex: 'var(--gs-z-sticky, 1100)',
          paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
        }}
      >
        {/* Quantity stepper */}
        <div
          className="flex items-center gap-2 border border-border rounded-[var(--gs-radius-lg,0.75rem)] px-2 py-1"
          role="group"
          aria-label="Quantity"
        >
          <button
            onClick={() => setQuantity((q) => Math.max(1, q - 1))}
            className="h-11 w-11 flex items-center justify-center text-muted-foreground gs-focus-ring rounded-[var(--gs-radius-md,0.5rem)]"
            aria-label="Decrease quantity"
          >
            <Minus size={16} aria-hidden="true" />
          </button>
          <span
            className="font-mono w-5 text-center"
            aria-live="polite"
            aria-atomic="true"
            aria-label={`Quantity: ${quantity}`}
          >
            {quantity}
          </span>
          <button
            onClick={() => setQuantity((q) => q + 1)}
            className="h-11 w-11 flex items-center justify-center text-muted-foreground gs-focus-ring rounded-[var(--gs-radius-md,0.5rem)]"
            aria-label="Increase quantity"
          >
            <Plus size={16} aria-hidden="true" />
          </button>
        </div>

        {/* Add to cart CTA */}
        <button
          onClick={handleAddToCart}
          disabled={isOutOfStock}
          aria-label={`Add ${quantity} ${item.name} to cart for ${formatNpr(unitPrice * quantity)}`}
          className="flex-1 bg-primary text-primary-foreground py-3 text-sm font-semibold disabled:opacity-40 active:scale-[0.98] transition-transform gs-focus-ring"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
        >
          Add to cart · {formatNpr(unitPrice * quantity)}
        </button>
      </div>
    </div>
  )
}