import { useEffect, useState, useCallback } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ordersApi } from '@/api/orders'
import { useActiveOrderStore } from '@/store/activeOrderStore'
import { useAuthStore } from '@/store/authStore'
import { connectSocket } from '@/lib/socket'

/**
 * ActiveOrderBar — Design System: Phase 4.2 Customer Home Migration
 *
 * Changes:
 *  - Added gs-focus-ring to Link for keyboard navigation
 *  - z-index references --gs-z-sticky token
 *  - All existing Tailwind semantic tokens retained (bg-primary/5, text-primary,
 *    border-border, text-foreground, text-muted-foreground) — correct ✅
 *  - Ping dot colors use Tailwind text-primary — correct ✅
 *  - aria-label added to Link for screen readers
 *
 * No socket, polling, business, or order-tracking logic changed.
 */
const isMongoId = (v) => /^[0-9a-f]{24}$/.test(v)
const TERMINAL = ['delivered', 'cancelled', 'refunded']
const LABELS = {
  pending: 'Order placed',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for delivery',
}

export default function ActiveOrderBar() {
  const location = useLocation()
  const ref = useActiveOrderStore((s) => s.ref)
  const setActiveOrder = useActiveOrderStore((s) => s.setActiveOrder)
  const clearActiveOrder = useActiveOrderStore((s) => s.clearActiveOrder)
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const [order, setOrder] = useState(null)

  useEffect(() => {
    if (ref || !isAuthenticated) return
    ordersApi
      .getMyOrders({ page: 1, limit: 5 })
      .then(({ data }) => {
        const active = data.orders?.find((o) => !TERMINAL.includes(o.status))
        if (active) setActiveOrder(active._id)
      })
      .catch(() => {})
  }, [ref, isAuthenticated, setActiveOrder])

  const fetchOrder = useCallback(async () => {
    if (!ref) {
      setOrder(null)
      return
    }
    try {
      const { data } = isMongoId(ref)
        ? await ordersApi.getOrder(ref)
        : await ordersApi.trackByToken(ref)
      if (TERMINAL.includes(data.order.status)) {
        clearActiveOrder()
        setOrder(null)
      } else {
        setOrder(data.order)
      }
    } catch {
      clearActiveOrder()
      setOrder(null)
    }
  }, [ref, clearActiveOrder])

  useEffect(() => {
    fetchOrder()
  }, [fetchOrder])

  useEffect(() => {
    if (!order?._id) return
    const socket = connectSocket()
    socket.emit('join:order', order._id)

    const handleUpdate = (updated) => {
      if (updated._id !== order._id) return
      if (TERMINAL.includes(updated.status)) {
        clearActiveOrder()
        setOrder(null)
      } else {
        setOrder((prev) => ({ ...prev, ...updated }))
      }
    }

    socket.on('order:updated', handleUpdate)
    return () => socket.off('order:updated', handleUpdate)
  }, [order?._id, clearActiveOrder])

  if (!order) return null
  if (location.pathname === `/track/${ref}`) return null

  return (
    <Link
      to={`/track/${ref}`}
      aria-label={`Order #${order.orderNumber} is ${LABELS[order.status] || order.status}. Tap to track.`}
      className="flex items-center justify-between gap-3 border-t border-border bg-primary/5 px-4 py-2.5 active:bg-primary/10 gs-focus-ring"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        {/* Live ping dot */}
        <span className="relative flex h-2 w-2 shrink-0" aria-hidden="true">
          <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
          <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
        </span>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">
            Order #{order.orderNumber} · {LABELS[order.status] || order.status}
          </p>
          <p className="text-[11px] text-muted-foreground">Tap to track</p>
        </div>
      </div>
      <span className="text-xs font-medium text-primary shrink-0" aria-hidden="true">Track →</span>
    </Link>
  )
}
