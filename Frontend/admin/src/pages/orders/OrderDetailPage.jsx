import { useParams, useNavigate } from 'react-router-dom'
import { useState, useEffect, useRef } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getOrder, updateOrderStatus, cancelOrder, editOrder } from '@/api/orders'
import { format } from 'date-fns'
import { toast } from 'sonner'
import {
  ArrowLeft, Printer, MapPin, Clock, User, Phone,
  Wallet, Ticket, StickyNote, CheckCircle2, Circle, Edit3, XCircle,
  Plus, Search, ArrowLeftCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { STATUS_COLORS, NEXT_STATUS, NEXT_LABEL } from '@/lib/orderConstants'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import Modal from '@/components/ui/Modal'
import { getAdminMenuItems } from '@/api/menu'

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
  const [cancelModal, setCancelModal] = useState(false)
  const [cancelReason, setCancelReason] = useState('')
  const [editNoteModal, setEditNoteModal] = useState(false)
  const [specialNoteText, setSpecialNoteText] = useState('')
  const [editItemsModal, setEditItemsModal] = useState(false)
  const [draftItems, setDraftItems] = useState([])
  const [pendingAddItems, setPendingAddItems] = useState([])
  const [showAddPicker, setShowAddPicker] = useState(false)
  const [pickerSearch, setPickerSearch] = useState('')
  const [pickerMenuItems, setPickerMenuItems] = useState([])
  const [pickerLoading, setPickerLoading] = useState(false)
  const [pickerSelected, setPickerSelected] = useState(null) // the menu item currently being configured
  const [pickerVariantId, setPickerVariantId] = useState(null)
  const [pickerAddonIds, setPickerAddonIds] = useState([])
  const [pickerQty, setPickerQty] = useState(1)

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

  const cancelMut = useMutation({
    mutationFn: (reason) => cancelOrder(id, reason),
    onSuccess: () => {
      toast.success('Order cancelled successfully')
      setCancelModal(false)
      setCancelReason('')
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Cancellation failed'),
  })

  const editMut = useMutation({
    mutationFn: (data) => editOrder(id, data),
    onSuccess: () => {
      toast.success('Order instructions updated')
      setEditNoteModal(false)
      queryClient.invalidateQueries({ queryKey: ['order', id] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Edit failed'),
  })

  const editItemsMut = useMutation({
    mutationFn: (data) => editOrder(id, data),
    onSuccess: () => {
      toast.success('Order items updated')
      setEditItemsModal(false)
      queryClient.invalidateQueries({ queryKey: ['order', id] })
      queryClient.invalidateQueries({ queryKey: ['orders'] })
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed to update items'),
  })

  const openAddPicker = () => {
    setShowAddPicker(true)
    setPickerSelected(null)
    setPickerSearch('')
    loadPickerItems('')
  }

  const loadPickerItems = async (term) => {
    setPickerLoading(true)
    try {
      const { data } = await getAdminMenuItems({ isAvailable: true, limit: 30, search: term || undefined })
      setPickerMenuItems(data.items || [])
    } catch {
      toast.error('Failed to load menu')
    } finally {
      setPickerLoading(false)
    }
  }

  // Debounced live search against the backend — scales to any menu size
  // instead of relying on a capped client-side list.
  const pickerSearchTimer = useRef(null)
  useEffect(() => {
    if (!showAddPicker || pickerSelected) return
    if (pickerSearchTimer.current) clearTimeout(pickerSearchTimer.current)
    pickerSearchTimer.current = setTimeout(() => {
      loadPickerItems(pickerSearch)
    }, 300)
    return () => clearTimeout(pickerSearchTimer.current)
  }, [pickerSearch, showAddPicker])

  const selectPickerItem = (item) => {
    setPickerSelected(item)
    const firstAvailableVariant = item.variants?.find((v) => v.isAvailable)
    setPickerVariantId(firstAvailableVariant?._id || null)
    setPickerAddonIds([])
    setPickerQty(1)
  }

  const confirmAddPickedItem = () => {
    const item = pickerSelected
    if (!item) return
    const variant = item.variants?.find((v) => v._id === pickerVariantId)
    const addons = (item.addons || []).filter((a) => pickerAddonIds.includes(a._id))
    const unitPrice = variant ? variant.price : item.basePrice
    setPendingAddItems((prev) => [
      ...prev,
      {
        tempId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        menuItemId: item._id,
        name: item.name,
        variantId: variant?._id || undefined,
        variantName: variant?.name,
        addonIds: addons.map((a) => a._id),
        addonNames: addons.map((a) => a.name),
        unitPrice,
        addonsTotal: addons.reduce((s, a) => s + a.price, 0),
        quantity: pickerQty,
      },
    ])
    setShowAddPicker(false)
    setPickerSelected(null)
  }

  const filteredPickerItems = pickerMenuItems.filter((m) =>
    m.name.toLowerCase().includes(pickerSearch.toLowerCase())
  )

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
          {!isCancelled && order.status !== 'delivered' && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => {
                setCancelReason('')
                setCancelModal(true)
              }}
              className="text-red-600 hover:text-red-700 hover:bg-red-50 border-red-200 gs-admin-focus-ring"
            >
              <XCircle size={14} className="mr-2" aria-hidden="true" />
              Cancel Order
            </Button>
          )}
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
            <div className="flex justify-between items-center mb-3">
              <p
                id="items-heading"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide"
              >
                Items
              </p>
              {!isCancelled && order.status !== 'delivered' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setDraftItems(order.items.map((it) => ({ ...it })))
                    setPendingAddItems([])
                    setShowAddPicker(false)
                    setPickerSelected(null)
                    setEditItemsModal(true)
                  }}
                  className="h-8 px-2 text-xs font-semibold gs-admin-focus-ring"
                >
                  <Edit3 size={13} className="mr-1" />
                  Edit Items
                </Button>
              )}
            </div>
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
          <div className="space-y-3">
            <div
              className="bg-amber-50 p-4 flex items-start justify-between gap-3 border border-amber-200"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div className="flex gap-3">
                <StickyNote size={16} className="text-amber-600 shrink-0 mt-0.5" aria-hidden="true" />
                <div>
                  <p className="text-xs font-medium text-amber-700 mb-1">Special Instructions</p>
                  <p className="text-sm text-amber-900 font-medium">
                    {order.specialInstructions || <span className="italic text-amber-600/70">No special instructions provided</span>}
                  </p>
                </div>
              </div>
              {!isCancelled && order.status !== 'delivered' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSpecialNoteText(order.specialInstructions || '')
                    setEditNoteModal(true)
                  }}
                  className="h-8 px-2 bg-amber-100/50 hover:bg-amber-100 text-amber-800 border-amber-300 gs-admin-focus-ring"
                >
                  <Edit3 size={13} className="mr-1" aria-hidden="true" />
                  Edit
                </Button>
              )}
            </div>

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

      {/* Cancel Order Modal */}
      {cancelModal && (
        <Modal
          open
          onClose={() => setCancelModal(false)}
          title={`Cancel Order #${order.orderNumber}`}
          size="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              if (!cancelReason.trim()) return toast.error('Please enter a cancellation reason')
              cancelMut.mutate(cancelReason)
            }}
            className="p-5 space-y-4"
          >
            <p className="text-sm text-muted-foreground">
              Are you sure you want to cancel this order? This action will notify the customer and restore inventory if applicable.
            </p>
            <div className="space-y-1.5">
              <Label htmlFor="cancel-reason">Cancellation Reason *</Label>
              <Input
                id="cancel-reason"
                required
                value={cancelReason}
                onChange={(e) => setCancelReason(e.target.value)}
                placeholder="e.g. Customer requested cancellation via phone"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setCancelModal(false)}
              >
                Back
              </Button>
              <Button
                type="submit"
                variant="destructive"
                className="flex-1"
                disabled={cancelMut.isPending}
              >
                {cancelMut.isPending && <Spinner size="sm" className="mr-2" />}
                Confirm Cancel
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Special Instructions Modal */}
      {editNoteModal && (
        <Modal
          open
          onClose={() => setEditNoteModal(false)}
          title={`Edit Instructions — Order #${order.orderNumber}`}
          size="sm"
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              editMut.mutate({ specialInstructions: specialNoteText })
            }}
            className="p-5 space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="special-instructions">Customer Special Instructions</Label>
              <Input
                id="special-instructions"
                value={specialNoteText}
                onChange={(e) => setSpecialNoteText(e.target.value)}
                placeholder="e.g. Extra spicy, no onions, less oil"
              />
            </div>
            <div className="flex gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                className="flex-1"
                onClick={() => setEditNoteModal(false)}
              >
                Cancel
              </Button>
              <Button
                type="submit"
                style={{
                  backgroundColor: 'var(--gs-admin-accent)',
                  color: 'var(--gs-admin-accent-foreground)',
                }}
                className="flex-1"
                disabled={editMut.isPending}
              >
                {editMut.isPending && <Spinner size="sm" className="mr-2" />}
                Save Changes
              </Button>
            </div>
          </form>
        </Modal>
      )}

      {/* Edit Items Modal — quantity correction, removal, and adding/swapping items */}
      {editItemsModal && (
        <Modal
          open
          onClose={() => setEditItemsModal(false)}
          title={
            showAddPicker
              ? pickerSelected
                ? pickerSelected.name
                : 'Add an item'
              : `Edit Items — Order #${order.orderNumber}`
          }
          size="sm"
        >
          {showAddPicker ? (
            <div className="p-5 space-y-4">
              <button
                type="button"
                onClick={() => (pickerSelected ? setPickerSelected(null) : setShowAddPicker(false))}
                className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground hover:text-foreground"
              >
                <ArrowLeftCircle size={14} aria-hidden="true" />
                Back
              </button>

              {!pickerSelected ? (
                <>
                  <div className="relative">
                    <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
                    <Input
                      value={pickerSearch}
                      onChange={(e) => setPickerSearch(e.target.value)}
                      placeholder="Search menu…"
                      className="pl-9"
                      autoFocus
                    />
                  </div>
                  {pickerLoading ? (
                    <div className="flex justify-center py-8"><Spinner size="md" /></div>
                  ) : (
                    <ul className="space-y-1.5 max-h-80 overflow-y-auto">
                      {filteredPickerItems.map((item) => (
                        <li key={item._id}>
                          <button
                            type="button"
                            onClick={() => selectPickerItem(item)}
                            className="w-full flex items-center justify-between gap-3 border border-border p-2.5 text-left hover:border-primary/50 hover:bg-primary/5 transition-colors gs-admin-focus-ring"
                            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                          >
                            <span className="text-sm font-medium text-foreground truncate">{item.name}</span>
                            <span className="text-xs font-mono text-muted-foreground shrink-0">
                              Rs. {item.variants?.length ? item.variants[0].price : item.basePrice}
                            </span>
                          </button>
                        </li>
                      ))}
                      {filteredPickerItems.length === 0 && (
                        <p className="text-sm text-muted-foreground text-center py-6">No items found.</p>
                      )}
                    </ul>
                  )}
                </>
              ) : (
                <div className="space-y-4">
                  {pickerSelected.variants?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Choose an option</p>
                      <div className="flex flex-col gap-1.5">
                        {pickerSelected.variants.filter((v) => v.isAvailable).map((v) => (
                          <label
                            key={v._id}
                            className="flex items-center justify-between gap-2 border border-border px-3 py-2 text-sm cursor-pointer"
                            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="radio"
                                name="picker-variant"
                                checked={pickerVariantId === v._id}
                                onChange={() => setPickerVariantId(v._id)}
                              />
                              {v.name}
                            </span>
                            <span className="font-mono text-xs">Rs. {v.price}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  {pickerSelected.addons?.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-foreground mb-2">Add-ons</p>
                      <div className="flex flex-col gap-1.5">
                        {pickerSelected.addons.filter((a) => a.isAvailable).map((a) => (
                          <label
                            key={a._id}
                            className="flex items-center justify-between gap-2 border border-border px-3 py-2 text-sm cursor-pointer"
                            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                          >
                            <span className="flex items-center gap-2">
                              <input
                                type="checkbox"
                                checked={pickerAddonIds.includes(a._id)}
                                onChange={() =>
                                  setPickerAddonIds((prev) =>
                                    prev.includes(a._id) ? prev.filter((x) => x !== a._id) : [...prev, a._id]
                                  )
                                }
                              />
                              {a.name}
                            </span>
                            <span className="font-mono text-xs">+Rs. {a.price}</span>
                          </label>
                        ))}
                      </div>
                    </div>
                  )}
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold text-foreground">Quantity</span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                      onClick={() => setPickerQty((q) => Math.max(1, q - 1))}>−</Button>
                    <span className="w-5 text-center text-sm font-semibold">{pickerQty}</span>
                    <Button type="button" variant="outline" size="icon" className="h-7 w-7"
                      onClick={() => setPickerQty((q) => Math.min(10, q + 1))}>+</Button>
                  </div>
                  <Button
                    type="button"
                    onClick={confirmAddPickedItem}
                    style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
                    className="w-full"
                  >
                    Add to order
                  </Button>
                </div>
              )}
            </div>
          ) : (
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (draftItems.length === 0 && pendingAddItems.length === 0) {
                  return toast.error('An order must have at least one item — cancel the order instead')
                }
                const changedItems = draftItems
                  .filter((d) => {
                    const original = order.items.find((o) => o._id === d._id)
                    return original && original.quantity !== d.quantity
                  })
                  .map((d) => ({ _id: d._id, quantity: d.quantity }))
                const removeItemIds = order.items
                  .filter((o) => !draftItems.some((d) => d._id === o._id))
                  .map((o) => o._id)
                const addItems = pendingAddItems.map((p) => ({
                  menuItemId: p.menuItemId,
                  quantity: p.quantity,
                  variantId: p.variantId,
                  addonIds: p.addonIds,
                }))
                if (changedItems.length === 0 && removeItemIds.length === 0 && addItems.length === 0) {
                  setEditItemsModal(false)
                  return
                }
                editItemsMut.mutate({ items: changedItems, removeItemIds, addItems })
              }}
              className="p-5 space-y-4"
            >
              <p className="text-sm text-muted-foreground">
                Adjust quantities, remove items, or add a different dish — priced fresh off the current menu.
              </p>
              <ul className="space-y-3 max-h-72 overflow-y-auto">
                {draftItems.map((item) => (
                  <li
                    key={item._id}
                    className="flex items-center justify-between gap-3 border border-border p-3"
                    style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.name}
                        {item.variant?.name && (
                          <span className="text-muted-foreground font-normal"> ({item.variant.name})</span>
                        )}
                      </p>
                      <p className="text-xs text-muted-foreground">Rs. {item.unitPrice} each</p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 gs-admin-focus-ring"
                        onClick={() =>
                          setDraftItems((prev) =>
                            prev.map((d) => (d._id === item._id ? { ...d, quantity: Math.max(1, d.quantity - 1) } : d))
                          )
                        }
                        aria-label={`Decrease quantity of ${item.name}`}
                      >
                        −
                      </Button>
                      <span className="w-5 text-center text-sm font-semibold" aria-live="polite">
                        {item.quantity}
                      </span>
                      <Button
                        type="button"
                        variant="outline"
                        size="icon"
                        className="h-7 w-7 gs-admin-focus-ring"
                        onClick={() =>
                          setDraftItems((prev) =>
                            prev.map((d) => (d._id === item._id ? { ...d, quantity: Math.min(10, d.quantity + 1) } : d))
                          )
                        }
                        aria-label={`Increase quantity of ${item.name}`}
                      >
                        +
                      </Button>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 gs-admin-focus-ring"
                        onClick={() => setDraftItems((prev) => prev.filter((d) => d._id !== item._id))}
                        aria-label={`Remove ${item.name} from order`}
                      >
                        <XCircle size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}

                {pendingAddItems.map((item) => (
                  <li
                    key={item.tempId}
                    className="flex items-center justify-between gap-3 border border-primary/40 bg-primary/5 p-3"
                    style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-foreground truncate">
                        {item.name}
                        {item.variantName && (
                          <span className="text-muted-foreground font-normal"> ({item.variantName})</span>
                        )}
                        <span className="ml-1.5 text-[10px] font-bold uppercase tracking-wide text-primary">New</span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Rs. {item.unitPrice} each{item.addonNames?.length ? ` + ${item.addonNames.join(', ')}` : ''}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="w-5 text-center text-sm font-semibold">{item.quantity}</span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-red-500 hover:text-red-600 hover:bg-red-50 gs-admin-focus-ring"
                        onClick={() => setPendingAddItems((prev) => prev.filter((p) => p.tempId !== item.tempId))}
                        aria-label={`Remove ${item.name} from order`}
                      >
                        <XCircle size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </li>
                ))}
              </ul>

              <button
                type="button"
                onClick={openAddPicker}
                className="w-full flex items-center justify-center gap-1.5 border border-dashed border-border py-2.5 text-xs font-semibold text-muted-foreground hover:text-foreground hover:border-foreground/40 transition-colors gs-admin-focus-ring"
                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
              >
                <Plus size={14} aria-hidden="true" />
                Add / swap an item
              </button>

              <div className="flex gap-2 pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="flex-1"
                  onClick={() => setEditItemsModal(false)}
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  style={{
                    backgroundColor: 'var(--gs-admin-accent)',
                    color: 'var(--gs-admin-accent-foreground)',
                  }}
                  className="flex-1"
                  disabled={editItemsMut.isPending}
                >
                  {editItemsMut.isPending && <Spinner size="sm" className="mr-2" />}
                  Save Changes
                </Button>
              </div>
            </form>
          )}
        </Modal>
      )}
    </div>
  )
}