import { useEffect, useState, useCallback, useId } from 'react'
import { useParams, useLocation, Link } from 'react-router-dom'
import { toast } from 'sonner'
import { X, CheckCircle2 } from 'lucide-react'
import { ordersApi } from '@/api/orders'
import { useActiveOrderStore } from '@/store/activeOrderStore'
import { getSocket, connectSocket } from '@/lib/socket'
import { getErrorMessage } from '@/lib/errorMessage'
import { formatNpr } from '@/lib/utils'
import PageHeader from '@/components/layout/PageHeader'
import StatusTimeline from '@/components/orders/StatusTimeline'
import RateOrderCard from '@/components/orders/RateOrderCard'


const isMongoId = (v) => /^[0-9a-f]{24}$/.test(v)
const isTrackingToken = (v) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/.test(v)

export default function OrderTracking() {
  const { orderId: ref } = useParams()
  const location = useLocation()
  const justPlaced = location.state?.justPlaced
  const isGuest = location.state?.isGuest
  const trackingToken = location.state?.trackingToken
  const [order, setOrder] = useState(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [cancelling, setCancelling] = useState(false)
  const clearActiveOrder = useActiveOrderStore((s) => s.clearActiveOrder)

  // Stable section IDs
  const timelineId = useId()
  const celebrationId = useId()
  const itemsId = useId()
  const summaryId = useId()
  const addressId = useId()
  const paymentId = useId()
  const ratingId = useId()

  const fetchOrder = useCallback(async () => {
    try {
      let data
      if (isMongoId(ref)) {
        data = (await ordersApi.getOrder(ref)).data
      } else if (isTrackingToken(ref)) {
        data = (await ordersApi.trackByToken(ref)).data
      } else {
        setNotFound(true)
        setLoading(false)
        return
      }
      setOrder(data.order)
    } catch {
      setNotFound(true)
    } finally {
      setLoading(false)
    }
  }, [ref])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  
  useEffect(() => {
    if (!order?._id) return

    const socket = connectSocket()
    socket.emit('join:order', order._id)

    const handleUpdate = (updated) => {
      if (updated._id !== order._id) return

      
      fetchOrder()

      if (updated.status === 'delivered') {
        toast.success('Order delivered! How was it?')
      } else {
        toast.info(`Order status: ${updated.status.replace(/_/g, ' ')}`)
      }
    }

    socket.on('order:updated', handleUpdate)
    return () => socket.off('order:updated', handleUpdate)
  }, [order?._id, fetchOrder])

  const handleCancel = async () => {
    if (!isMongoId(ref)) {
      toast.error("Guest orders can't be cancelled here — please contact us directly.")
      return
    }
    setCancelling(true)
    try {
      await ordersApi.cancelOrder(order._id, 'Cancelled by customer')
      toast.success('Order cancelled')
      clearActiveOrder()
      fetchOrder()
    } catch (err) {
      toast.error(getErrorMessage(err))
    } finally {
      setCancelling(false)
    }
  }

  // ── Loading state ────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="min-h-dvh flex flex-col">
        <PageHeader title="Track order" />
        <main
          className="flex-1 px-4 py-4 flex flex-col gap-4"
          role="status"
          aria-busy="true"
          aria-label="Loading order details"
        >
          <div className="gs-skeleton h-32 w-full" style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }} />
          <div className="gs-skeleton h-48 w-full" style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }} />
          <span className="sr-only">Loading your order...</span>
        </main>
      </div>
    )
  }

  // ── Not found state ──────────────────────────────────────────────────────────
  if (notFound || !order) {
    return (
      <div className="min-h-dvh flex flex-col">
        <PageHeader title="Track order" />
        <main
          className="flex-1 flex flex-col items-center justify-center gap-2 px-8 text-center"
          role="status"
          aria-label="Order not found"
        >
          <p className="text-sm text-muted-foreground">
            Order not found. Check your tracking link.
          </p>
          <Link
            to="/"
            className="text-primary text-sm underline mt-2 gs-focus-ring rounded-sm py-1 px-2"
          >
            Back to menu
          </Link>
        </main>
      </div>
    )
  }

  const isCancellable = ['pending', 'confirmed'].includes(order.status)

  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader title={`Order #${order.orderNumber}`} />

      <main className="flex-1 px-4 py-4 flex flex-col gap-6">

        {/* ── Order placed confirmation ── */}
        {justPlaced && (
          <section
            className="flex flex-col items-center gap-1.5 border border-accent/30 bg-accent/10 p-4 text-center"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
            role="status"
            aria-label="Order placed successfully"
          >
            <CheckCircle2 size={28} className="text-accent" aria-hidden="true" />
            <p className="text-sm font-semibold text-foreground">Order placed!</p>
            {isGuest && trackingToken && (
              <p className="text-xs text-muted-foreground">
                Save this tracking link — you'll need it since you checked out as a guest:
                <br />
                <span className="font-mono text-foreground">/track/{trackingToken}</span>
              </p>
            )}
          </section>
        )}

        {/* ── Status timeline ── */}
        <section aria-labelledby={timelineId}>
          <h2 id={timelineId} className="sr-only">Order status</h2>
          <StatusTimeline status={order.status} />
        </section>

        {/* ── Celebration details ── */}
        {order.orderType === 'celebration' && order.celebrationDetails && (
          <section
            aria-labelledby={celebrationId}
            className="bg-secondary/10 border border-secondary/20 p-4"
            style={{ borderRadius: 'var(--gs-radius-xl, 1rem)' }}
          >
            <h2
              id={celebrationId}
              className="font-display text-sm font-semibold text-foreground mb-2"
            >
              🎉 Celebration Details
            </h2>
            <div className="space-y-1.5 text-sm text-muted-foreground">
              <div className="flex justify-between">
                <span>Type:</span>
                <span className="font-medium text-foreground">
                  {order.celebrationDetails.celebrationType}
                </span>
              </div>
              <div className="flex justify-between">
                <span>Date:</span>
                <span className="font-medium text-foreground">
                  {new Date(order.celebrationDetails.eventDate).toLocaleDateString('en-US', {
                    month: 'short',
                    day: 'numeric',
                    year: 'numeric',
                  })}
                </span>
              </div>
              {order.celebrationDetails.eventTime && (
                <div className="flex justify-between">
                  <span>Time:</span>
                  <span className="font-medium text-foreground">
                    {order.celebrationDetails.eventTime}
                  </span>
                </div>
              )}
              <div className="border-t border-border mt-2 pt-2 flex justify-between font-semibold text-foreground">
                <span>Advance Paid:</span>
                <span>{formatNpr(order.celebrationDetails.advanceAmount || 0)}</span>
              </div>
              <div className="flex justify-between font-semibold text-foreground">
                <span>Balance Due:</span>
                <span>{formatNpr(order.celebrationDetails.balanceAmount || 0)}</span>
              </div>
            </div>
          </section>
        )}

        {/* ── Rating ── */}
        {order.status === 'delivered' && isMongoId(ref) && (
          order.rating?.food ? (
            <section
              className="border border-border bg-card p-4"
              style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
              aria-labelledby={ratingId}
            >
              <h2 id={ratingId} className="sr-only">Your rating</h2>
              <p className="text-sm font-medium text-foreground">
                You rated this order {order.rating.food}★
                {order.rating.delivery ? ` (delivery ${order.rating.delivery}★)` : ''}
              </p>
              {order.rating.comment && (
                <p className="text-sm text-muted-foreground mt-1">"{order.rating.comment}"</p>
              )}
            </section>
          ) : (
            <RateOrderCard
              order={order}
              onRated={(rating) => setOrder((prev) => ({ ...prev, rating }))}
            />
          )
        )}

        {/* ── Items ── */}
        <section aria-labelledby={itemsId}>
          <h2 id={itemsId} className="font-display text-sm text-foreground mb-2">
            Items
          </h2>
          <ol role="list" aria-label="Order items" className="flex flex-col gap-2">
            {order.items.map((item, i) => (
              <li key={i} role="listitem" className="flex justify-between text-sm">
                <span className="text-foreground">
                  {item.quantity}× {item.menuItem?.name || item.name}
                </span>
                <span
                  className="font-mono text-muted-foreground"
                  aria-label={formatNpr(item.totalPrice || item.unitPrice * item.quantity)}
                >
                  {formatNpr(item.totalPrice || item.unitPrice * item.quantity)}
                </span>
              </li>
            ))}
          </ol>
        </section>

        {/* ── Order summary ── */}
        <section
          aria-labelledby={summaryId}
          className="flex flex-col gap-1.5 text-sm"
          role="region"
        >
          <h2 id={summaryId} className="sr-only">Order summary</h2>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Subtotal</span>
            <span
              className="font-mono"
              aria-label={`Subtotal: ${formatNpr(order.subtotal)}`}
            >
              {formatNpr(order.subtotal)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">Delivery fee</span>
            <span
              className="font-mono"
              aria-label={`Delivery fee: ${formatNpr(order.deliveryFee)}`}
            >
              {formatNpr(order.deliveryFee)}
            </span>
          </div>
          {order.couponDiscount > 0 && (
            <div
              className="flex justify-between text-accent"
              role="status"
              aria-label={`Coupon ${order.couponCode} discount: ${formatNpr(order.couponDiscount)}`}
            >
              <span>Coupon ({order.couponCode})</span>
              <span className="font-mono">-{formatNpr(order.couponDiscount)}</span>
            </div>
          )}
          <div
            className="flex justify-between font-semibold text-primary pt-1 border-t border-border mt-1"
            aria-label={`Order total: ${formatNpr(order.totalAmount)}`}
          >
            <span>Total</span>
            <span className="font-mono">{formatNpr(order.totalAmount)}</span>
          </div>
        </section>

        {/* ── Delivery address ── */}
        {order.deliveryType === 'delivery' && order.deliveryAddress && (
          <section aria-labelledby={addressId}>
            <h2 id={addressId} className="font-display text-sm text-foreground mb-1">
              Delivery address
            </h2>
            <p className="text-sm text-muted-foreground">
              {[order.deliveryAddress.street, order.deliveryAddress.area, order.deliveryAddress.city]
                .filter(Boolean)
                .join(', ')}
            </p>
          </section>
        )}

        {/* ── Payment ── */}
        <section aria-labelledby={paymentId}>
          <h2 id={paymentId} className="font-display text-sm text-foreground mb-1">
            Payment
          </h2>
          <p className="text-sm text-muted-foreground capitalize">
            {order.paymentMethod} · {order.paymentStatus}
          </p>
        </section>

        {/* ── Cancel ── */}
        {isCancellable && (
          <button
            type="button"
            onClick={handleCancel}
            disabled={cancelling}
            aria-busy={cancelling}
            aria-label={cancelling ? 'Cancelling your order...' : 'Cancel this order'}
            className="flex items-center justify-center gap-1.5 border border-destructive text-destructive py-2.5 text-sm font-medium disabled:opacity-50 active:scale-[0.98] transition-transform gs-focus-ring min-h-[44px]"
            style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)' }}
          >
            <X size={15} aria-hidden="true" />
            {cancelling ? 'Cancelling...' : 'Cancel order'}
          </button>
        )}
      </main>
    </div>
  )
}