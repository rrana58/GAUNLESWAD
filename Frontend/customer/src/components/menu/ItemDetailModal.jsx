import { useMemo, useState, useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { toast } from 'sonner'
import { X, Leaf, Flame, Minus, Plus } from 'lucide-react'
import { menuApi } from '@/api/menu'
import { useCartStore } from '@/store/cartStore'
import { useItemModalStore } from '@/store/itemModalStore'
import { formatNpr, cn } from '@/lib/utils'
import RatingStars from '@/components/menu/RatingStars'
import { useNavigate } from 'react-router-dom'


export default function ItemDetailModal() {
  const navigate = useNavigate()
  const { selectedItemId, isOpen, closeModal } = useItemModalStore()
  const addItem = useCartStore((s) => s.addItem)
  const dialogRef = useRef(null)

  const { data: item, isLoading } = useQuery({
    queryKey: ['menu-item', selectedItemId],
    queryFn: () => menuApi.getItem(selectedItemId).then((r) => r.data.item),
    enabled: !!selectedItemId && isOpen,
  })

  const [quantity, setQuantity] = useState(1)
  const [notes, setNotes] = useState('')
  const [prevItemId, setPrevItemId] = useState(selectedItemId)

  // Reset state when a new item is opened (render phase update)
  if (selectedItemId !== prevItemId) {
    setPrevItemId(selectedItemId)
    setQuantity(1)
    setNotes('')
  }

  // Move focus into the dialog on open for keyboard/SR users
  useEffect(() => {
    if (isOpen && dialogRef.current) {
      dialogRef.current.focus()
    }
  }, [isOpen, selectedItemId])

  // Close on Escape key
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e) => { if (e.key === 'Escape') closeModal() }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [isOpen, closeModal])

  const unitPrice = useMemo(() => {
    return item?.discountedPrice ?? item?.basePrice ?? 0
  }, [item])

  const rawUnitPrice = useMemo(() => {
    return item?.basePrice ?? 0
  }, [item])

  const handleAddToCart = () => {
    addItem({
      menuItemId: item._id,
      name: item.name,
      price: item.discountedPrice ?? item.basePrice ?? rawUnitPrice,
      image: item.image?.url,
      quantity,
      specialInstructions: notes.trim() || undefined,
    })
    closeModal()
    toast.success(`${item.name} added to cart`, {
      action: {
        label: 'Go to cart',
        onClick: () => navigate('/cart')
      }
    })
  }

  const isOutOfStock = item?.stockQuantity != null && item.stockQuantity <= 0
  const headingId = 'item-modal-title'

  if (!isOpen) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
        style={{ zIndex: 'var(--gs-z-modal, 1300)' }}
        onClick={closeModal}
        aria-hidden="true"
      />

      {/* Bottom Sheet Dialog */}
      <div
        ref={dialogRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
        className="fixed inset-x-0 bottom-0 bg-background flex flex-col max-h-[85vh] transform transition-transform outline-none"
        style={{
          zIndex: 'var(--gs-z-modal, 1300)',
          borderTopLeftRadius: 'var(--gs-radius-2xl, 1.5rem)',
          borderTopRightRadius: 'var(--gs-radius-2xl, 1.5rem)',
          boxShadow: 'var(--gs-shadow-modal)',
          transitionDuration: 'var(--gs-motion-smooth, 300ms)',
          transitionTimingFunction: 'ease-out',
        }}
      >
        {/* Drag handle */}
        <div
          className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 bg-muted-foreground/20 rounded-full"
          aria-hidden="true"
        />

        {/* Close button */}
        <button
          onClick={closeModal}
          aria-label="Close item details"
          className="absolute top-4 right-4 h-8 w-8 rounded-full bg-muted flex items-center justify-center text-muted-foreground hover:bg-muted/80 z-10 gs-focus-ring"
        >
          <X size={18} aria-hidden="true" />
        </button>

        {/* Scrollable content */}
        <div className="flex-1 overflow-y-auto pb-24 mt-8">
          {isLoading ? (
            <div className="p-4 space-y-4">
              <div className="aspect-4/3 gs-skeleton rounded-(--gs-radius-lg,0.75rem)" />
              <div className="h-6 w-2/3 gs-skeleton rounded-(--gs-radius-md,0.5rem)" />
              <div className="h-4 w-full gs-skeleton rounded-(--gs-radius-md,0.5rem)" />
            </div>
          ) : !item ? (
            <div className="p-8 text-center text-muted-foreground">Item not found.</div>
          ) : (
            <>
              {/* Product image */}
              {item.image?.url && (
                <div
                  className="relative aspect-video mx-4 mb-4 overflow-hidden"
                  style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
                >
                  <img
                    src={item.image.url}
                    alt={item.name}
                    className="h-full w-full object-cover"
                  />
                </div>
              )}

              <div className="px-4 pt-2">
                {/* Title + dietary icons */}
                <div className="flex items-start justify-between gap-3">
                  <h1
                    id={headingId}
                    className="font-display text-2xl font-bold text-foreground"
                  >
                    {item.name}
                  </h1>
                  <div className="flex gap-1 shrink-0 pt-1">
                    {item.isVeg && (
                      <span
                        className="p-1 bg-accent/10 rounded-full"
                        aria-label="Vegetarian"
                        title="Vegetarian"
                      >
                        <Leaf size={16} className="text-accent" aria-hidden="true" />
                      </span>
                    )}
                    {item.isSpicy && (
                      <span
                        className="p-1 bg-destructive/10 rounded-full"
                        aria-label="Spicy"
                        title="Spicy"
                      >
                        <Flame size={16} className="text-destructive" aria-hidden="true" />
                      </span>
                    )}
                  </div>
                </div>

                {/* Rating */}
                {item.avgRating > 0 && (
                  <div className="flex items-center gap-1.5 mt-2">
                    <RatingStars value={item.avgRating} />
                    <span className="text-xs font-medium text-muted-foreground">
                      {item.avgRating.toFixed(1)} ({item.totalReviews} reviews)
                    </span>
                  </div>
                )}

                {/* Description */}
                {item.description && (
                  <p className="text-sm text-muted-foreground mt-3 leading-relaxed">
                    {item.description}
                  </p>
                )}

                {/* Allergens */}
                {item.allergens?.length > 0 && (
                  <p
                    className="text-xs font-medium text-muted-foreground mt-3 bg-muted px-2 py-1 w-max"
                    style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
                  >
                    Contains: {item.allergens.join(', ')}
                  </p>
                )}

                {/* Out of stock */}
                {isOutOfStock && (
                  <p
                    className="mt-4 text-sm font-semibold text-destructive bg-destructive/10 px-3 py-2 text-center"
                    style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
                    role="alert"
                  >
                    Currently out of stock.
                  </p>
                )}

                {/* Combo items */}
                {(item.isCombo || item.comboItems?.length > 0) && (
                  <div
                    className="mt-5 bg-primary/5 border border-primary/20 p-3.5"
                    style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
                  >
                    <h2 className="font-display font-semibold text-sm text-foreground mb-2.5 flex items-center gap-1.5">
                      <span aria-hidden="true">🍱</span>
                      Items included in this Combo:
                    </h2>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                      {item.comboItems?.map((ci, idx) => {
                        const subItem = typeof ci.item === 'object' && ci.item !== null ? ci.item : null
                        const itemName = subItem ? subItem.name : (typeof ci.item === 'string' ? ci.item : 'Item')
                        const itemImg = subItem?.image?.url
                        return (
                          <div
                            key={idx}
                            className="flex items-center gap-2.5 border p-2"
                            style={{
                              backgroundColor: 'var(--gs-surface, #FFFFFF)',
                              borderColor: 'var(--gs-border, #E5E7EB)',
                              borderRadius: 'var(--gs-radius-lg, 0.75rem)',
                              boxShadow: 'var(--gs-shadow-xs)',
                            }}
                          >
                            <div
                              className="w-9 h-9 overflow-hidden shrink-0 flex items-center justify-center text-sm"
                              style={{
                                borderRadius: 'var(--gs-radius-md, 0.5rem)',
                                backgroundColor: 'var(--gs-bg, #FAF8F5)',
                              }}
                            >
                              {itemImg ? (
                                <img src={itemImg} alt={itemName} className="w-full h-full object-cover" />
                              ) : (
                                <span aria-hidden="true">🍲</span>
                              )}
                            </div>
                            <span className="text-xs font-semibold text-foreground leading-tight">
                              {itemName}
                            </span>
                          </div>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Special instructions */}
                <div className="mt-6 mb-2">
                  <h2 className="font-display font-semibold text-base text-foreground mb-3">
                    <label htmlFor="modal-special-instructions">Special instructions</label>
                  </h2>
                  <textarea
                    name="specialInstructions"
                    id="modal-special-instructions"
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="E.g. less spicy, no onions..."
                    rows={2}
                    className="w-full border-2 border-border bg-card px-4 py-3 text-sm outline-none resize-none transition-colors placeholder:text-muted-foreground/60 focus-visible:border-primary focus-visible:ring-2 focus-visible:ring-primary/20"
                    style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
                  />
                </div>
              </div>
            </>
          )}
        </div>

        {/* Fixed bottom action bar */}
        {item && !isLoading && (
          <div
            className="absolute bottom-0 inset-x-0 bg-card border-t border-border px-4 py-3 flex items-center gap-4"
            style={{
              zIndex: 'var(--gs-z-modal, 1300)',
              borderBottomLeftRadius: 'var(--gs-radius-2xl, 1.5rem)',
              borderBottomRightRadius: 'var(--gs-radius-2xl, 1.5rem)',
              paddingBottom: 'calc(0.75rem + env(safe-area-inset-bottom))',
            }}
          >
            {/* Quantity stepper */}
            <div
              className="flex items-center gap-3 bg-muted/50 rounded-full px-3 py-2"
              role="group"
              aria-label="Quantity"
            >
              <button
                onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                className="h-11 w-11 flex items-center justify-center text-foreground hover:bg-background rounded-full transition-colors gs-focus-ring"
                aria-label="Decrease quantity"
              >
                <Minus size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
              <span
                className="font-mono font-bold w-5 text-center"
                aria-live="polite"
                aria-atomic="true"
                aria-label={`Quantity: ${quantity}`}
              >
                {quantity}
              </span>
              <button
                onClick={() => setQuantity((q) => q + 1)}
                className="h-11 w-11 flex items-center justify-center text-foreground hover:bg-background rounded-full transition-colors gs-focus-ring"
                aria-label="Increase quantity"
              >
                <Plus size={18} strokeWidth={2.5} aria-hidden="true" />
              </button>
            </div>

            {/* Add to cart CTA */}
            <button
              onClick={handleAddToCart}
              disabled={isOutOfStock}
              aria-label={`Add ${quantity} ${item.name} to cart for ${formatNpr(unitPrice * quantity)}`}
              className="flex-1 rounded-full bg-primary text-primary-foreground py-3.5 text-[15px] font-bold disabled:opacity-40 active:scale-[0.98] transition-transform flex justify-between items-center px-6 gs-focus-ring"
              style={{ boxShadow: 'var(--gs-shadow-md)' }}
            >
              <span>Add to cart</span>
              <span className="font-mono tracking-tight" aria-hidden="true">
                {formatNpr(unitPrice * quantity)}
              </span>
            </button>
          </div>
        )}
      </div>
    </>
  )
}
