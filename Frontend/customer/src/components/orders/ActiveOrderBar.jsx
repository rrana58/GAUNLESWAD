import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { ordersApi } from '@/api/orders'
import { useActiveOrderStore } from '@/store/activeOrderStore'
import { useAuthStore } from '@/store/authStore'
import { connectSocket } from '@/lib/socket'

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

  const refs = useActiveOrderStore((s) => s.refs)
  const currentIndex = useActiveOrderStore((s) => s.currentIndex)
  const setActiveOrder = useActiveOrderStore((s) => s.setActiveOrder)
  const removeOrder = useActiveOrderStore((s) => s.removeOrder)
  const nextOrder = useActiveOrderStore((s) => s.nextOrder)
  const previousOrder = useActiveOrderStore((s) => s.previousOrder)

  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)

  const currentRef = refs[currentIndex] || null
  const [order, setOrder] = useState(null)

  useEffect(() => {
    if (refs.length > 0 || !isAuthenticated) return

    ordersApi
      .getMyOrders({ page: 1, limit: 20 })
      .then(({ data }) => {
        const activeOrders = (data.orders || [])
          .filter((item) => !TERMINAL.includes(item.status))
          .map((item) => item._id)
          .reverse()

        activeOrders.forEach((ref) => setActiveOrder(ref))
      })
      .catch(() => {})
  }, [refs.length, isAuthenticated, setActiveOrder])

  useEffect(() => {
    let cancelled = false

    if (!currentRef) {
      return () => {
        cancelled = true
      }
    }

    const loadOrder = async () => {
      try {
        const { data } = isMongoId(currentRef)
          ? await ordersApi.getOrder(currentRef)
          : await ordersApi.trackByToken(currentRef)

        if (cancelled) return

        if (TERMINAL.includes(data.order.status)) {
          removeOrder(currentRef)
          setOrder(null)
        } else {
          setOrder(data.order)
        }
      } catch {
        if (cancelled) return

        removeOrder(currentRef)
        setOrder(null)
      }
    }

    loadOrder()

    return () => {
      cancelled = true
    }
  }, [currentRef, removeOrder])

  useEffect(() => {
    const socket = connectSocket()

    refs.forEach((ref) => {
      if (isMongoId(ref)) {
        socket.emit('join:order', ref)
      }
    })

    const handleUpdate = (updated) => {
      if (!updated?._id) return

      const ref = updated._id

      if (!refs.includes(ref)) return

      if (TERMINAL.includes(updated.status)) {
        removeOrder(ref)

        if (ref === currentRef) {
          setOrder(null)
        }

        return
      }

      if (ref === currentRef) {
        setOrder((prev) => ({ ...prev, ...updated }))
      }
    }

    socket.on('order:updated', handleUpdate)

    return () => {
      socket.off('order:updated', handleUpdate)
    }
  }, [refs, currentRef, removeOrder])

  if (!order || !currentRef) return null

  if (location.pathname === `/track/${currentRef}`) return null

  const hasMultipleOrders = refs.length > 1

  return (
    <div className="flex items-center border-t border-border bg-primary/5">
      {hasMultipleOrders && (
        <button
          type="button"
          onClick={previousOrder}
          aria-label="Previous active order"
          className="px-2.5 py-2.5 text-sm text-muted-foreground hover:text-foreground gs-focus-ring"
        >
          ‹
        </button>
      )}

      <Link
        to={`/track/${currentRef}`}
        aria-label={`Order #${order.orderNumber} is ${
          LABELS[order.status] || order.status
        }. Tap to track.`}
        className="flex min-w-0 flex-1 items-center justify-between gap-3 px-2 py-2.5 active:bg-primary/10 gs-focus-ring"
      >
        <div className="flex min-w-0 items-center gap-2.5">
          <span
            className="relative flex h-2 w-2 shrink-0"
            aria-hidden="true"
          >
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>

          <div className="min-w-0">
            <p className="truncate text-xs font-semibold text-foreground">
              Order #{order.orderNumber} ·{' '}
              {LABELS[order.status] || order.status}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {hasMultipleOrders
                ? `${currentIndex + 1} of ${refs.length} · Tap to track`
                : 'Tap to track'}
            </p>
          </div>
        </div>

        <span
          className="shrink-0 text-xs font-medium text-primary"
          aria-hidden="true"
        >
          Track ?
        </span>
      </Link>

      {hasMultipleOrders && (
        <button
          type="button"
          onClick={nextOrder}
          aria-label="Next active order"
          className="px-2.5 py-2.5 text-sm text-muted-foreground hover:text-foreground gs-focus-ring"
        >
          ›
        </button>
      )}
    </div>
  )
}
