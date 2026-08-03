import { Star, Leaf, Flame, Plus } from 'lucide-react'
import { formatNpr, cn } from '@/lib/utils'
import { useItemModalStore } from '@/store/itemModalStore'
import { useCartStore } from '@/store/cartStore'
import { toast } from 'sonner'
import { useNavigate } from 'react-router-dom'

/**
 * MenuItemCard — Design System: Phase 4.2 Customer Home Migration
 *
 * Changes:
 *  - Card shadow: inline rgba strings → var(--gs-shadow-sm/md)
 *  - Quick-add button: div → button (WCAG: interactive elements must be buttons)
 *  - Quick-add: bg-white → var(--gs-surface); text-primary + hover:bg-primary/text-white retained via Tailwind
 *  - Discount badge: bg-secondary → uses Tailwind secondary (correctly set in customer @theme)
 *  - Veg/spicy badges: bg-white/95 → var(--gs-surface)
 *  - Card border-radius: rounded-2xl → var(--gs-radius-2xl) explicitly
 *  - Added gs-focus-ring for keyboard navigation
 *  - Added ARIA label to card button for screen readers
 *  - aria-label on quick-add button retained and improved
 *
 * No business logic, cart logic, modal logic, or toast behavior changed.
 */
export default function MenuItemCard({ item }) {
  const navigate = useNavigate()
  const price = item.discountedPrice ?? item.basePrice
  const hasDiscount = item.discountedPrice != null && item.discountedPrice < item.originalPrice
  const openModal = useItemModalStore(s => s.openModal)
  const addItem = useCartStore(s => s.addItem)

  const handleQuickAdd = (e) => {
    e.preventDefault()
    e.stopPropagation()

    if (!item.isAvailable) {
      toast.error('Item is currently unavailable')
      return
    }

    if (item.variants?.length > 0 || item.addons?.length > 0) {
      toast.info('Please select options to add this item.')
      openModal(item._id)
      return
    }

    addItem({
      menuItemId: item._id,
      name: item.name,
      price: price,
      quantity: 1,
      image: item.image?.url,
    })
    toast.success('Added to cart', {
      action: {
        label: 'Go to cart',
        onClick: () => navigate('/cart')
      }
    })
  }

  return (
    <button
      onClick={() => openModal(item._id)}
      aria-label={`View ${item.name} — ${formatNpr(price)}`}
      className={cn(
        'group flex flex-col overflow-hidden bg-card border border-border text-left w-full relative',
        'active:scale-[0.98] transition-all gs-focus-ring',
        'rounded-[var(--gs-radius-xl,1rem)]',
      )}
      style={{
        transitionDuration: 'var(--gs-motion-normal, 200ms)',
        boxShadow: 'var(--gs-shadow-sm)',
      }}
      onMouseOver={(e) => { e.currentTarget.style.boxShadow = 'var(--gs-shadow-md)' }}
      onMouseOut={(e) => { e.currentTarget.style.boxShadow = 'var(--gs-shadow-sm)' }}
    >
      {/* Food photo */}
      <div className="relative aspect-4/3 bg-muted w-full overflow-hidden shrink-0">
        {item.image?.url ? (
          <img
            src={item.image.url}
            alt={item.name}
            loading="lazy"
            className="h-full w-full object-cover group-hover:scale-105 transition-transform duration-500"
          />
        ) : (
          <div
            className="h-full w-full flex items-center justify-center text-3xl"
            style={{ color: 'var(--gs-text-disabled, #9CA3AF)' }}
            aria-hidden="true"
          >
            🍲
          </div>
        )}

        {/* Veg / Spicy badges */}
        <div className="absolute top-2 left-2 flex gap-1 z-10">
          {item.isVeg && (
            <span
              className="h-6 w-6 rounded-full backdrop-blur shadow-sm flex items-center justify-center"
              style={{ backgroundColor: 'var(--gs-surface, #FFFFFF)' }}
              title="Vegetarian"
              aria-label="Vegetarian"
            >
              <Leaf size={13} className="text-accent" aria-hidden="true" />
            </span>
          )}
          {item.isSpicy && (
            <span
              className="h-6 w-6 rounded-full backdrop-blur shadow-sm flex items-center justify-center"
              style={{ backgroundColor: 'var(--gs-surface, #FFFFFF)' }}
              title="Spicy"
              aria-label="Spicy"
            >
              <Flame size={13} className="text-destructive" aria-hidden="true" />
            </span>
          )}
        </div>

        {/* Discount badge */}
        {hasDiscount && (
          <span className="absolute top-2 right-2 rounded-full bg-secondary text-secondary-foreground px-2 py-0.5 text-[10px] font-bold z-10"
            style={{ boxShadow: 'var(--gs-shadow-sm)' }}
          >
            -{Math.round(((item.originalPrice - item.discountedPrice) / item.originalPrice) * 100)}%
          </span>
        )}

        {/* Quick-add button — changed from div to button for WCAG */}
        <button
          type="button"
          onClick={handleQuickAdd}
          aria-label={`Quick add ${item.name} to cart`}
          className="absolute bottom-2 right-2 w-8 h-8 rounded-full shadow-md flex items-center justify-center active:scale-90 transition-transform z-10 hover:bg-primary hover:text-white gs-focus-ring"
          style={{
            backgroundColor: 'var(--gs-surface, #FFFFFF)',
            color: 'var(--gs-primary, #1B3A25)',
            boxShadow: 'var(--gs-shadow-md)',
          }}
        >
          <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
        </button>
      </div>

      {/* Card body */}
      <div className="flex flex-col gap-1 p-3 flex-1">
        <h3 className="font-display text-[15px] font-medium leading-tight text-foreground line-clamp-1 group-hover:text-primary transition-colors">
          {item.name}
        </h3>
        {item.avgRating > 0 && (
          <div className="flex items-center gap-1 text-[11px] text-muted-foreground font-medium">
            <Star size={12} className="fill-secondary text-secondary" aria-hidden="true" />
            <span aria-label={`Rating: ${item.avgRating.toFixed(1)} out of 5`}>
              {item.avgRating.toFixed(1)}
            </span>
          </div>
        )}
        <div className="flex items-baseline gap-2 mt-auto pt-1">
          <span className="font-mono font-bold text-foreground text-[15px]">
            {formatNpr(price)}
          </span>
          {hasDiscount && (
            <span className="font-mono text-xs font-medium text-muted-foreground line-through">
              {formatNpr(item.originalPrice)}
            </span>
          )}
        </div>
      </div>
    </button>
  )
}