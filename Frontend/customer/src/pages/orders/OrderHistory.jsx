import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { Star } from 'lucide-react'
import { ordersApi } from '@/api/orders'
import { formatNpr, cn } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'

/**
 * OrderHistory — Design System: Phase 4.6 Orders Migration
 *
 * Token changes:
 *  - Order card link: rounded-lg → var(--gs-radius-lg); added var(--gs-shadow-sm)
 *  - Status badge: rounded-full → var(--gs-radius-full)
 *  - Celebration badge: bg-purple-100 text-purple-700 rounded → var(--gs-secondary)/10 + text-secondary + var(--gs-radius-sm)
 *  - Pagination buttons: added h-11 w-11 touch targets + gs-focus-ring
 *  - Empty state link: added gs-focus-ring
 *  - Browse link: added gs-focus-ring
 *
 * Accessibility:
 *  - Page: <main> landmark for content area
 *  - Loading: role="status" aria-busy + gs-skeleton placeholder
 *  - Empty state: role="status"
 *  - Orders list: <ol role="list"> + aria-label with count
 *  - Each card: <li role="listitem">
 *  - Order link: descriptive aria-label with number/status/total/date
 *  - Status badge: aria-label on span
 *  - Rate star: aria-hidden on icon, "Rate this order" text retained
 *  - Star icon: aria-hidden="true"
 *  - Pagination: role="navigation" + aria-label + aria-current on page indicator
 *  - Previous/Next: descriptive aria-label
 *
 * Query, pagination state, API calls unchanged.
 */

const STATUS_STYLES = {
  pending: 'bg-muted text-muted-foreground',
  confirmed: 'bg-secondary/20 text-secondary-foreground',
  preparing: 'bg-secondary/20 text-secondary-foreground',
  ready: 'bg-accent/20 text-accent',
  out_for_delivery: 'bg-accent/20 text-accent',
  delivered: 'bg-accent text-accent-foreground',
  cancelled: 'bg-destructive/10 text-destructive',
  refunded: 'bg-destructive/10 text-destructive',
}

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready for pickup',
  out_for_delivery: 'Out for delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  refunded: 'Refunded',
}

export default function OrderHistory() {
  const [page, setPage] = useState(1)

  const { data, isLoading } = useQuery({
    queryKey: ['my-orders', page],
    queryFn: () => ordersApi.getMyOrders({ page, limit: 10 }).then((r) => r.data),
    keepPreviousData: true,
  })

  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader title="Your orders" showBackButton={true} />

      <main className="flex-1 px-4 py-4" aria-label="Order history">

        {/* Loading state */}
        {isLoading && (
          <div role="status" aria-label="Loading your orders" aria-busy="true" className="flex flex-col gap-3">
            {[1, 2, 3].map((n) => (
              <div
                key={n}
                className="gs-skeleton h-24 w-full"
                style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              />
            ))}
            <span className="sr-only">Loading your orders...</span>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && data?.orders?.length === 0 && (
          <div
            className="flex flex-col items-center justify-center gap-2 py-16 text-center"
            role="status"
            aria-label="No orders found"
          >
            <p className="text-sm text-muted-foreground">No orders yet.</p>
            <Link
              to="/"
              className="text-primary text-sm underline gs-focus-ring rounded-sm py-1 px-2"
            >
              Browse the menu
            </Link>
          </div>
        )}

        {/* Orders list */}
        {!isLoading && data?.orders?.length > 0 && (
          <ol
            role="list"
            aria-label={`${data.orders.length} order${data.orders.length !== 1 ? 's' : ''}`}
            className="flex flex-col gap-3"
          >
            {data.orders.map((order) => {
              const dateLabel = new Date(order.createdAt).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                year: 'numeric',
              })
              const statusLabel = STATUS_LABELS[order.status] || order.status.replace(/_/g, ' ')
              const itemCount = order.items.length

              return (
                <li key={order._id} role="listitem">
                  <Link
                    to={`/track/${order._id}`}
                    aria-label={`Order #${order.orderNumber} — ${statusLabel} — ${itemCount} item${itemCount !== 1 ? 's' : ''} on ${dateLabel} — ${formatNpr(order.totalAmount)}`}
                    className="flex flex-col gap-1.5 border border-border bg-card p-3 active:scale-[0.99] transition-transform gs-focus-ring"
                    style={{
                      borderRadius: 'var(--gs-radius-lg, 0.75rem)',
                      boxShadow: 'var(--gs-shadow-sm)',
                    }}
                  >
                    {/* Header row: order number + status badge */}
                    <div className="flex items-center justify-between">
                      <span className="font-display text-sm text-foreground">
                        #{order.orderNumber}
                      </span>
                      <span
                        className={cn(
                          'text-[11px] font-medium px-2 py-0.5 capitalize',
                          STATUS_STYLES[order.status] || 'bg-muted text-muted-foreground'
                        )}
                        style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
                        aria-label={`Status: ${statusLabel}`}
                      >
                        {order.status.replace(/_/g, ' ')}
                      </span>
                    </div>

                    {/* Meta row: item count + date + celebration badge */}
                    <div className="flex items-center gap-2 mt-1">
                      <p className="text-xs text-muted-foreground">
                        {itemCount} item{itemCount !== 1 ? 's' : ''} · {dateLabel}
                      </p>
                      {order.orderType === 'celebration' && (
                        <span
                          className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5"
                          style={{
                            borderRadius: 'var(--gs-radius-sm, 0.25rem)',
                            backgroundColor: 'color-mix(in srgb, var(--gs-secondary, #B58A63) 15%, transparent)',
                            color: 'var(--gs-secondary, #B58A63)',
                          }}
                          aria-label="Celebration order"
                        >
                          Celebration
                        </span>
                      )}
                    </div>

                    {/* Total */}
                    <p
                      className="font-mono text-sm font-semibold text-primary"
                      aria-label={`Total: ${formatNpr(order.totalAmount)}`}
                    >
                      {formatNpr(order.totalAmount)}
                    </p>

                    {/* Rate prompt */}
                    {order.status === 'delivered' && !order.rating?.food && (
                      <span className="inline-flex items-center gap-1 self-start text-[11px] font-medium text-secondary-foreground">
                        <Star
                          size={11}
                          className="fill-secondary text-secondary"
                          aria-hidden="true"
                        />
                        Rate this order
                      </span>
                    )}
                  </Link>
                </li>
              )
            })}
          </ol>
        )}

        {/* Pagination */}
        {data && data.totalPages > 1 && (
          <nav
            aria-label="Order history pagination"
            className="flex items-center justify-between mt-4"
          >
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page === 1}
              aria-label="Go to previous page"
              className="h-11 px-3 text-sm text-primary disabled:text-muted-foreground disabled:opacity-50 gs-focus-ring rounded-[var(--gs-radius-md,0.5rem)]"
            >
              Previous
            </button>
            <span
              className="text-xs text-muted-foreground"
              aria-current="page"
              aria-label={`Page ${data.page} of ${data.totalPages}`}
            >
              Page {data.page} of {data.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(data.totalPages, p + 1))}
              disabled={page === data.totalPages}
              aria-label="Go to next page"
              className="h-11 px-3 text-sm text-primary disabled:text-muted-foreground disabled:opacity-50 gs-focus-ring rounded-[var(--gs-radius-md,0.5rem)]"
            >
              Next
            </button>
          </nav>
        )}
      </main>
    </div>
  )
}