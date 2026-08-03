import { useParams, useNavigate } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrder, updateOrderStatus } from '@/api/orders'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowLeft, Printer, MapPin, Clock, User, Phone,
  Wallet, Ticket, StickyNote, CheckCircle2, Circle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { STATUS_COLORS, NEXT_STATUS, NEXT_LABEL } from '@/lib/orderConstants'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'

/**
 * OrderDetailPage — Design System: Phase 5.3
 *
 * Token changes:
 *  - bg-white → bg-card on all panel cards
 *  - border-gray-100 → border-border
 *  - border-gray-50 → border-border on item dividers
 *  - text-gray-900 → text-foreground
 *  - text-gray-800 → text-foreground
 *  - text-gray-700 → text-foreground
 *  - text-gray-600 → text-muted-foreground
 *  - text-gray-500/400 → text-muted-foreground (and /60 variant)
 *  - rounded-xl → var(--gs-admin-radius-xl)
 *  - rounded-full (status, plan badge) → var(--gs-admin-radius-full)
 *  - bg-orange-500 (next action CTA) → var(--gs-admin-accent)
 *  - text-orange-500 (timeline check icon) → text-[var(--gs-admin-accent)]
 *  - bg-orange-400 (timeline connector) → var(--gs-admin-accent)
 *  - text-gray-200 (pending circle) → text-border (muted ring)
 *  - bg-gray-200 (pending connector) → bg-border
 *  - bg-gray-50 (admin note card) → bg-muted (neutral semantic)
 *  - Inline payment status span → <StatusBadge status={paymentStatus}>
 *  - Cancelled/refunded span → <StatusBadge status={order.status}>
 *  - Loader2 loading → <Spinner>
 *  - Loader2 in next-action button → <Spinner size="sm">
 *  - "Order not found" panel bg-white → bg-card
 *
 * Preserved (intentional semantic colours):
 *  - bg-amber-50 text-amber-600/700 (special instructions)
 *  - bg-red-50 text-red-600/700 (cancellation reason)
 *  - bg-green-100 text-green-700 (plan meal free badge)
 *  - text-green-600 (coupon discount)
 *  - Print block: font-mono text-black border-dashed border-black (intentional print CSS)
 *
 * Accessibility:
 *  - <main aria-label="Order #{n} details"> wraps screen content
 *  - Back button: existing aria-label="Back to orders" preserved; ArrowLeft aria-hidden
 *  - Print button: aria-label added; Printer icon aria-hidden
 *  - Next-action button: aria-busy + aria-label; Loader2 → Spinner
 *  - Status timeline: <ol aria-label> + <li> with aria-current="step" on active
 *  - Timeline CheckCircle2/Circle icons: aria-hidden
 *  - Items list: <ul aria-label> + <li> (replaces div.space-y-3 + div)
 *  - Sidebar cards: role="region" + aria-labelledby on each
 *  - Sidebar info icons (User/Phone/MapPin/Clock/Wallet/Ticket/StickyNote): aria-hidden
 *  - Payment sidebar: StatusBadge replaces inline coloured span
 *  - Special instructions card: StickyNote icon aria-hidden
 *  - Admin note card: StickyNote icon aria-hidden
 *  - Cancellation reason card: role="region" aria-label
 *  - Error state: role="alert"
 *  - Print block: unchanged (non-interactive, print-only)
 *
 * No query, mutation, routing, or state logic changed.
 */

const TIMELINE_STEPS = ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered']

// Map payment status to StatusBadge values
const PAYMENT_STATUS_MAP = {
  paid: 'paid',
  failed: 'failed',
  pending: 'pending',
  unpaid: 'unpaid',
}

export default function OrderDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data: order, isLoading, isError } = useQuery({
    queryKey: ['order', id],
    queryFn: () => getOrder(id).then((r) => r.data.order),
    enabled: !!id,
  })

  const updateStatus = useMutation({
    mutationFn: ({ status }) => updateOrderStatus(id, status),
    onSuccess: () => {
      toast.success('Order status updated')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  if (isLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="Loading order…" />
      </div>
    )
  }

  if (isError || !order) {
    return (
      <div className="space-y-4" role="alert" aria-label="Order not found">
        <Button
          variant="outline"
          size="sm"
          onClick={() => navigate('/orders')}
          aria-label="Back to orders"
          className="gs-admin-focus-ring"
        >
          <ArrowLeft size={14} className="mr-2" aria-hidden="true" />
          Back to Orders
        </Button>
        <div
          className="bg-card border border-border p-10 text-center text-muted-foreground"
          style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
        >
          Order not found.
        </div>
      </div>
    )
  }

  const customerName = order.customer?.name || order.guestInfo?.name || 'Guest'
  const customerPhone = order.customer?.phone || order.guestInfo?.phone
  const timelineIndex = TIMELINE_STEPS.indexOf(order.status)
  const isCancelled = order.status === 'cancelled' || order.status === 'refunded'

  return (
    <div className="space-y-5">
      {/* Header — hidden on print */}
      <header className="flex items-center justify-between print:hidden">
        <div className="flex items-center gap-3">
          <Button
            variant="outline"
            size="icon"
            onClick={() => navigate('/orders')}
            aria-label="Back to orders"
            className="gs-admin-focus-ring"
          >
            <ArrowLeft size={16} aria-hidden="true" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold text-foreground">Order #{order.orderNumber}</h1>
            <p className="text-muted-foreground text-sm mt-0.5">
              Placed {format(new Date(order.createdAt), 'MMM d, yyyy, h:mm a')}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => window.print()}
            aria-label="Print kitchen ticket"
            className="gs-admin-focus-ring"
          >
            <Printer size={14} className="mr-2" aria-hidden="true" />
            Print Ticket
          </Button>
          {NEXT_STATUS[order.status] && (
            <Button
              size="sm"
              style={{
                backgroundColor: 'var(--gs-admin-accent)',
                color: 'var(--gs-admin-accent-foreground)',
              }}
              aria-label={NEXT_LABEL[order.status]}
              aria-busy={updateStatus.isPending}
              onClick={() => updateStatus.mutate({ status: NEXT_STATUS[order.status] })}
              disabled={updateStatus.isPending}
              className="gs-admin-focus-ring"
            >
              {updateStatus.isPending && (
                <Spinner size="sm" label="Updating status…" className="mr-2" />
              )}
              {NEXT_LABEL[order.status]}
            </Button>
          )}
        </div>
      </header>

      {/* Screen content (hidden on print) */}
      <main
        className="grid grid-cols-1 lg:grid-cols-3 gap-5 print:hidden"
        aria-label={`Order #${order.orderNumber} details`}
      >
        {/* ── Main column ─────────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-5">

          {/* Status timeline */}
          <section
            className="bg-card border border-border p-5"
            role="region"
            aria-labelledby="timeline-heading"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            <p
              id="timeline-heading"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-4"
            >
              Status
            </p>
            {isCancelled ? (
              <StatusBadge status={order.status} size="lg" />
            ) : (
              <ol
                className="flex items-center"
                aria-label="Order status timeline"
              >
                {TIMELINE_STEPS.map((step, i) => {
                  const done = i <= timelineIndex
                  const current = i === timelineIndex
                  return (
                    <li
                      key={step}
                      className="flex items-center flex-1 last:flex-none"
                      aria-current={current ? 'step' : undefined}
                    >
                      <div className="flex flex-col items-center gap-1.5">
                        {done ? (
                          <CheckCircle2
                            size={20}
                            className="text-[var(--gs-admin-accent)]"
                            aria-hidden="true"
                          />
                        ) : (
                          <Circle
                            size={20}
                            className="text-border"
                            aria-hidden="true"
                          />
                        )}
                        <span
                          className={`text-[11px] capitalize whitespace-nowrap ${
                            done ? 'text-foreground font-medium' : 'text-muted-foreground/60'
                          }`}
                        >
                          {step.replace(/_/g, ' ')}
                        </span>
                      </div>
                      {i < TIMELINE_STEPS.length - 1 && (
                        <div
                          aria-hidden="true"
                          className="h-0.5 flex-1 mx-1 mb-4"
                          style={{
                            backgroundColor: i < timelineIndex
                              ? 'var(--gs-admin-accent)'
                              : 'oklch(0.922 0 0)',
                          }}
                        />
                      )}
                    </li>
                  )
                })}
              </ol>
            )}
          </section>

          {/* Items */}
          <section
            className="bg-card border border-border p-5"
            role="region"
            aria-labelledby="items-heading"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            <p
              id="items-heading"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-3"
            >
              Items
            </p>
            <ul className="space-y-3" aria-label="Order items">
              {order.items?.map((item, i) => (
                <li
                  key={i}
                  className="flex justify-between text-sm border-b border-border last:border-0 pb-3 last:pb-0"
                >
                  <div>
                    <p className="text-foreground font-medium">
                      {item.quantity}× {item.name}
                      {item.variant?.name && (
                        <span className="text-muted-foreground font-normal"> ({item.variant.name})</span>
                      )}
                      {item.planMeal?.applied && (
                        <span
                          className="ml-2 text-xs bg-green-100 text-green-700 px-1.5 py-0.5"
                          style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                        >
                          Free — Plan Meal
                        </span>
                      )}
                    </p>
                    {item.specialInstructions && (
                      <p className="text-xs text-amber-600 mt-0.5">Note: {item.specialInstructions}</p>
                    )}
                  </div>
                  <span className="font-semibold text-foreground shrink-0 ml-4">
                    Rs. {item.totalPrice?.toLocaleString()}
                  </span>
                </li>
              ))}
            </ul>

            <div className="border-t border-border mt-4 pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>Rs. {order.subtotal?.toLocaleString()}</span>
              </div>
              {order.deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery fee</span>
                  <span>Rs. {order.deliveryFee}</span>
                </div>
              )}
              {order.couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon ({order.couponCode})</span>
                  <span>- Rs. {order.couponDiscount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground pt-1.5 border-t border-border">
                <span>Total</span>
                <span>Rs. {order.totalAmount?.toLocaleString()}</span>
              </div>
            </div>
          </section>

          {/* Special instructions & admin note */}
          {(order.specialInstructions || order.adminNote) && (
            <div className="space-y-3">
              {order.specialInstructions && (
                <div
                  className="bg-amber-50 p-4 flex gap-3"
                  style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                >
                  <StickyNote size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium text-amber-700 mb-1">Special Instructions</p>
                    <p className="text-sm text-amber-700">{order.specialInstructions}</p>
                  </div>
                </div>
              )}
              {order.adminNote && (
                <div
                  className="bg-muted p-4 flex gap-3"
                  style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                >
                  <StickyNote size={16} className="text-muted-foreground shrink-0 mt-0.5" aria-hidden="true" />
                  <div>
                    <p className="text-xs font-medium text-muted-foreground mb-1">Admin Note</p>
                    <p className="text-sm text-muted-foreground">{order.adminNote}</p>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>

        {/* ── Sidebar column ──────────────────────────────────────── */}
        <div className="space-y-5">

          {/* Customer */}
          <section
            className="bg-card border border-border p-5 space-y-3"
            role="region"
            aria-labelledby="customer-heading"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            <p
              id="customer-heading"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Customer
            </p>
            <div className="flex items-center gap-2 text-sm text-foreground">
              <User size={14} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
              {customerName}
            </div>
            {customerPhone && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Phone size={14} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
                {customerPhone}
              </div>
            )}
          </section>

          {/* Delivery / Pickup */}
          <section
            className="bg-card border border-border p-5 space-y-3"
            role="region"
            aria-labelledby="delivery-heading"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            <p
              id="delivery-heading"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              {order.deliveryType === 'pickup' ? 'Pickup' : 'Delivery'}
            </p>
            {order.deliveryType !== 'pickup' && order.deliveryAddress && (
              <div className="flex items-start gap-2 text-sm text-muted-foreground">
                <MapPin size={14} className="text-muted-foreground/60 mt-0.5 shrink-0" aria-hidden="true" />
                <span>
                  {order.deliveryAddress.street}
                  {order.deliveryAddress.area && `, ${order.deliveryAddress.area}`}
                  {order.deliveryAddress.city && `, ${order.deliveryAddress.city}`}
                  {order.deliveryAddress.landmark && (
                    <span className="block text-xs text-muted-foreground/60 mt-0.5">
                      Landmark: {order.deliveryAddress.landmark}
                    </span>
                  )}
                </span>
              </div>
            )}
            {order.scheduledFor && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
                Scheduled: {format(new Date(order.scheduledFor), 'MMM d, h:mm a')}
              </div>
            )}
            {order.estimatedDeliveryTime && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock size={14} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
                ETA: {format(new Date(order.estimatedDeliveryTime), 'h:mm a')}
              </div>
            )}
          </section>

          {/* Payment */}
          <section
            className="bg-card border border-border p-5 space-y-3"
            role="region"
            aria-labelledby="payment-heading"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            <p
              id="payment-heading"
              className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
            >
              Payment
            </p>
            <div className="flex items-center gap-2 text-sm">
              <Wallet size={14} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
              <span className="capitalize text-foreground">{order.paymentMethod}</span>
              <span className="ml-auto">
                <StatusBadge
                  status={PAYMENT_STATUS_MAP[order.paymentStatus] ?? order.paymentStatus}
                  size="sm"
                />
              </span>
            </div>
            {order.couponCode && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Ticket size={14} className="text-muted-foreground/60 shrink-0" aria-hidden="true" />
                {order.couponCode}
              </div>
            )}
          </section>

          {/* Cancellation reason — semantic red preserved */}
          {order.cancelReason && (
            <div
              className="bg-red-50 p-4"
              role="region"
              aria-label="Cancellation reason"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <p className="text-xs font-medium text-red-700 mb-1">Cancellation Reason</p>
              <p className="text-sm text-red-600">{order.cancelReason}</p>
            </div>
          )}
        </div>
      </main>

      {/* ── Printable kitchen ticket ─────────────────────────────────────── */}
      {/* NOTE: This block is intentionally print-only and uses black/mono
          for print compatibility. Do NOT migrate to design tokens. */}
      <div className="hidden print:block font-mono text-black text-sm w-full max-w-sm">
        <div className="text-center mb-3">
          <p className="font-bold text-base">GAUNLE SWAD</p>
          <p className="text-xs">Order Ticket</p>
        </div>
        <div className="border-t border-b border-dashed border-black py-2 mb-2">
          <p>Order #: {order.orderNumber}</p>
          <p>Date: {format(new Date(order.createdAt), 'MMM d, yyyy h:mm a')}</p>
          <p className="capitalize">Type: {order.deliveryType || 'delivery'}</p>
          <p className="capitalize">Payment: {order.paymentMethod} ({order.paymentStatus})</p>
        </div>
        <div className="mb-2">
          <p>Customer: {customerName}</p>
          {customerPhone && <p>Phone: {customerPhone}</p>}
          {order.deliveryType !== 'pickup' && order.deliveryAddress && (
            <p>
              Address: {order.deliveryAddress.street}
              {order.deliveryAddress.area && `, ${order.deliveryAddress.area}`}
              {order.deliveryAddress.city && `, ${order.deliveryAddress.city}`}
            </p>
          )}
        </div>
        <div className="border-t border-dashed border-black pt-2 mb-2">
          {order.items?.map((item, i) => (
            <div key={i} className="flex justify-between">
              <span>
                {item.quantity}x {item.name}{item.variant?.name ? ` (${item.variant.name})` : ''}
              </span>
              <span>Rs. {item.totalPrice?.toLocaleString()}</span>
            </div>
          ))}
        </div>
        <div className="border-t border-dashed border-black pt-2 space-y-0.5">
          <div className="flex justify-between"><span>Subtotal</span><span>Rs. {order.subtotal?.toLocaleString()}</span></div>
          {order.deliveryFee > 0 && (
            <div className="flex justify-between"><span>Delivery</span><span>Rs. {order.deliveryFee}</span></div>
          )}
          {order.couponDiscount > 0 && (
            <div className="flex justify-between"><span>Discount ({order.couponCode})</span><span>-Rs. {order.couponDiscount}</span></div>
          )}
          <div className="flex justify-between font-bold border-t border-dashed border-black pt-1 mt-1">
            <span>TOTAL</span><span>Rs. {order.totalAmount?.toLocaleString()}</span>
          </div>
        </div>
        {order.specialInstructions && (
          <div className="border-t border-dashed border-black mt-2 pt-2">
            <p>Note: {order.specialInstructions}</p>
          </div>
        )}
        <p className="text-center text-xs mt-3">Thank you! · Dhanyabad!</p>
      </div>
    </div>
  )
}
