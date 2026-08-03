import { useState, useEffect } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getOrders, updateOrderStatus, exportOrders } from '@/api/orders'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { RefreshCw, Eye, X, Download } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { useNotificationStore } from '@/store/notificationStore'
import { STATUSES, STATUS_COLORS, NEXT_STATUS, NEXT_LABEL } from '@/lib/orderConstants'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import Pagination from '@/components/ui/Pagination'
import Modal from '@/components/ui/Modal'
import EmptyState from '@/components/ui/EmptyState'
import FilterChips from '@/components/ui/FilterChips'

/**
 * OrdersPage — Design System: Phase 5.3
 *
 * Token changes:
 *  - bg-white → bg-card on filter panel + table panel
 *  - bg-gray-50 → bg-muted on table <thead>
 *  - border-gray-100 → border-border
 *  - divide-gray-50 → divide-border
 *  - text-gray-900 → text-foreground
 *  - text-gray-500/400 → text-muted-foreground
 *  - hover:bg-gray-50 → hover:bg-muted
 *  - rounded-xl → var(--gs-admin-radius-xl)
 *  - Order type chips: hardcoded → <FilterChips> (getActiveClass uses accent token)
 *  - Status filter pills: hardcoded buttons → <FilterChips> with STATUS_COLORS active class
 *  - Clear date filter X: text-gray-400 hover:text-gray-600 → text-muted-foreground hover:text-foreground
 *  - Export/Refresh buttons: icon aria-hidden
 *  - Loader2 loading → <Spinner>
 *  - "No orders found" empty div → <EmptyState>
 *  - Table header <th> → scope="col" on all 8 columns
 *  - Status column: inline STATUS_COLORS span → <StatusBadge>
 *  - Payment column: text-gray-500 → text-muted-foreground
 *  - Order number button: text-gray-600 hover:text-orange-600 → semantic + gs-admin-focus-ring
 *  - bg-orange-500 next-action button → style={{ backgroundColor:'var(--gs-admin-accent)' }}
 *  - Loader2 in action button → <Spinner size="sm">
 *  - Pagination: inline nav → <Pagination> component
 *  - Modal: inline fixed-inset-0 div → <Modal> component
 *  - Modal header: bg-white border-gray-100 → bg-card border-border (via Modal)
 *  - Modal title: text-gray-900 → text-foreground (via Modal)
 *  - Modal timestamp: text-gray-400 → text-muted-foreground
 *  - Modal section labels: text-gray-400 → text-muted-foreground
 *  - Modal body text: text-gray-900/700/600/500 → semantic
 *  - Modal totals border-gray-100 → border-border
 *  - Modal next action button: orange → accent
 *  - Celebration details: bg-purple-50 (intentional semantic — left unchanged)
 *  - Special instructions: bg-amber-50 (intentional semantic — left unchanged)
 *  - Plan meal "Free" badge: bg-green-100 text-green-700 (intentional semantic — left unchanged)
 *  - Coupon discount: text-green-600 (intentional semantic — left unchanged)
 *
 * Accessibility:
 *  - <main aria-label="Orders management"> wraps all
 *  - <header> for page title + actions
 *  - Filter panel: existing role="group" aria-labels preserved
 *  - Order type filter: <FilterChips role="group" aria-pressed> (via component)
 *  - Status filter: <FilterChips role="group" aria-pressed> (via component)
 *  - Date clear button: existing aria-label="Clear date filter" preserved; X icon aria-hidden
 *  - Export button: aria-busy={exporting}, Download icon aria-hidden
 *  - Refresh button: existing aria-label preserved; RefreshCw icon aria-hidden
 *  - Table: aria-label="All orders"
 *  - All <th>: scope="col"
 *  - Order number button: aria-label="View order #N", hover accent via gs-admin-focus-ring
 *  - Eye icon: aria-hidden (in View details button)
 *  - Status cells: <StatusBadge> with built-in aria-label
 *  - Next-action button: aria-busy={updateStatus.isPending}, aria-label
 *  - Empty state: <EmptyState role="status">
 *  - Spinner: role="status" aria-label (via Spinner)
 *  - Pagination: <Pagination aria-label="Order pagination"> (via component)
 *  - Modal: <Modal role="dialog" aria-modal aria-labelledby> (via component)
 *  - Modal customer/items/totals/address sections: role="group" aria-labelledby
 *
 * No query, mutation, routing, or state logic changed.
 */

const ORDER_TYPE_OPTIONS = [
  { value: 'all', label: 'All' },
  { value: 'standard', label: 'Standard' },
  { value: 'celebration', label: 'Celebration' },
  { value: 'subscription', label: 'Subscription' },
]

const STATUS_OPTIONS = [
  { value: '', label: 'All' },
  ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
]

export default function OrdersPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const clearUnread = useNotificationStore((s) => s.clearUnread)
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [orderType, setOrderType] = useState('all')
  const [dateFilter, setDateFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [exporting, setExporting] = useState(false)

  // Visiting the orders list clears the "new order" badge in the sidebar
  useEffect(() => {
    clearUnread()
  }, [clearUnread])

  const { data, isLoading, refetch } = useQuery({
    queryKey: ['orders', page, statusFilter, orderType, dateFilter],
    queryFn: () => getOrders({
      page,
      limit: 20,
      ...(statusFilter && { status: statusFilter }),
      ...(orderType !== 'all' && { orderType: orderType }),
      ...(dateFilter && { date: dateFilter }),
    }).then(r => r.data),
    refetchInterval: 20000,
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => updateOrderStatus(id, status),
    onSuccess: () => {
      toast.success('Order status updated')
      queryClient.invalidateQueries(['orders'])
      queryClient.invalidateQueries(['stats'])
      setSelectedOrder(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const handleExport = async () => {
    setExporting(true)
    try {
      const res = await exportOrders()
      const url = window.URL.createObjectURL(new Blob([res.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `orders-${new Date().toISOString().split('T')[0]}.csv`
      a.click()
      window.URL.revokeObjectURL(url)
      toast.success('Orders exported successfully')
    } catch {
      toast.error('Export failed')
    } finally {
      setExporting(false)
    }
  }

  const orders = data?.orders || []
  const totalPages = data?.totalPages || 1

  return (
    <main className="space-y-5" aria-label="Orders management">

      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Orders</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total || 0} total orders</p>
        </div>
        <div className="flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={handleExport}
            disabled={exporting}
            aria-label={exporting ? 'Exporting orders…' : 'Export orders as CSV'}
            aria-busy={exporting}
            className="gs-admin-focus-ring"
          >
            {exporting
              ? <Spinner size="sm" label="Exporting…" className="mr-2" />
              : <Download size={14} className="mr-2" aria-hidden="true" />
            }
            Export CSV
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => refetch()}
            aria-label="Refresh orders list"
            className="gs-admin-focus-ring"
          >
            <RefreshCw size={14} className="mr-2" aria-hidden="true" />
            Refresh
          </Button>
        </div>
      </header>

      {/* Filters */}
      <section
        className="bg-card border border-border p-4 flex flex-col gap-3"
        aria-label="Order filters"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        {/* Order type */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-muted-foreground mr-1" id="type-filter-label">
            Order Type:
          </span>
          <FilterChips
            options={ORDER_TYPE_OPTIONS}
            value={orderType}
            onChange={(v) => { setOrderType(v); setPage(1) }}
            label="Filter by order type"
            getActiveClass={() =>
              'bg-[var(--gs-admin-accent)] text-[var(--gs-admin-accent-foreground)] border-[var(--gs-admin-accent)]'
            }
          />
        </div>

        <div className="flex flex-wrap gap-3 items-center w-full">
          {/* Status filter */}
          <div className="flex flex-wrap gap-2 items-center">
            <span className="text-sm font-medium text-muted-foreground mr-1" id="status-filter-label">
              Status:
            </span>
            <FilterChips
              options={STATUS_OPTIONS}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1) }}
              label="Filter orders by status"
              getActiveClass={(v) =>
                v === ''
                  ? 'bg-foreground text-background border-foreground'
                  : STATUS_COLORS[v] || 'bg-muted text-foreground border-border'
              }
            />
          </div>

          {/* Date filter */}
          <div className="ml-auto flex items-center gap-2">
            <Label htmlFor="order-date-filter" className="sr-only">Filter by date</Label>
            <Input
              id="order-date-filter"
              name="dateFilter"
              type="date"
              value={dateFilter}
              onChange={(e) => { setDateFilter(e.target.value); setPage(1) }}
              className="h-8 text-sm w-40 gs-admin-focus-ring"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                aria-label="Clear date filter"
                className="text-muted-foreground hover:text-foreground transition-colors gs-admin-focus-ring"
                style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
              >
                <X size={14} aria-hidden="true" />
              </button>
            )}
          </div>
        </div>
      </section>

      {/* Orders table */}
      <section
        className="bg-card border border-border overflow-hidden"
        aria-label="Orders table"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        {isLoading ? (
          <div className="flex items-center justify-center h-64">
            <Spinner size="lg" label="Loading orders…" />
          </div>
        ) : orders.length === 0 ? (
          <EmptyState message="No orders found" sub="Try adjusting your filters or date range" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label="All orders">
              <thead className="bg-muted border-b border-border">
                <tr className="text-left text-muted-foreground text-xs">
                  <th scope="col" className="px-4 py-3 font-medium">Order #</th>
                  <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                  <th scope="col" className="px-4 py-3 font-medium">Items</th>
                  <th scope="col" className="px-4 py-3 font-medium">Total</th>
                  <th scope="col" className="px-4 py-3 font-medium">Payment</th>
                  <th scope="col" className="px-4 py-3 font-medium">Status</th>
                  <th scope="col" className="px-4 py-3 font-medium">Time</th>
                  <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {orders.map((order) => (
                  <tr key={order._id} className="hover:bg-muted transition-colors">
                    <td className="px-4 py-3 font-mono text-xs">
                      <button
                        onClick={() => navigate(`/orders/${order._id}`)}
                        aria-label={`View order #${order.orderNumber}`}
                        className="text-muted-foreground hover:text-[var(--gs-admin-accent)] hover:underline gs-admin-focus-ring"
                        style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}
                      >
                        #{order.orderNumber}
                      </button>
                    </td>
                    <td className="px-4 py-3">
                      <p className="font-medium text-foreground">
                        {order.customer?.name || order.guestInfo?.name || 'Guest'}
                      </p>
                      <p className="text-xs text-muted-foreground/60">
                        {order.customer?.phone || order.guestInfo?.phone}
                      </p>
                    </td>
                    <td className="px-4 py-3 text-muted-foreground">
                      {order.items?.slice(0, 2).map(i => i.name).join(', ')}
                      {order.items?.length > 2 && ` +${order.items.length - 2} more`}
                    </td>
                    <td className="px-4 py-3 font-semibold text-foreground">
                      Rs. {order.totalAmount?.toLocaleString()}
                    </td>
                    <td className="px-4 py-3">
                      <span className="capitalize text-xs text-muted-foreground">
                        {order.paymentMethod} · {order.paymentStatus}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <StatusBadge status={order.status} size="sm" />
                    </td>
                    <td className="px-4 py-3 text-xs text-muted-foreground/60">
                      {format(new Date(order.createdAt), 'MMM d, h:mm a')}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <Button
                          variant="ghost"
                          size="sm"
                          className="h-7 px-2 gs-admin-focus-ring"
                          aria-label={`View details for order #${order.orderNumber}`}
                          onClick={() => navigate(`/orders/${order._id}`)}
                        >
                          <Eye size={13} aria-hidden="true" />
                        </Button>
                        {NEXT_STATUS[order.status] && (
                          <Button
                            size="sm"
                            className="h-7 px-2 text-xs gs-admin-focus-ring"
                            style={{
                              backgroundColor: 'var(--gs-admin-accent)',
                              color: 'var(--gs-admin-accent-foreground)',
                            }}
                            aria-label={`${NEXT_LABEL[order.status]} for order #${order.orderNumber}`}
                            aria-busy={updateStatus.isPending}
                            onClick={() => updateStatus.mutate({
                              id: order._id,
                              status: NEXT_STATUS[order.status]
                            })}
                            disabled={updateStatus.isPending}
                          >
                            {updateStatus.isPending
                              ? <Spinner size="sm" label="Updating…" className="mr-1" />
                              : null
                            }
                            {NEXT_LABEL[order.status]}
                          </Button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          total={data?.total}
          onPage={setPage}
          label="orders"
        />
      </section>

      {/* Order quick-view modal */}
      <Modal
        open={!!selectedOrder}
        onClose={() => setSelectedOrder(null)}
        title={selectedOrder ? `Order #${selectedOrder.orderNumber}` : ''}
        size="md"
      >
        {selectedOrder && (
          <div className="p-5 space-y-4">

            {/* Modal timestamp */}
            <p className="text-xs text-muted-foreground -mt-1">
              {format(new Date(selectedOrder.createdAt), 'MMM d yyyy, h:mm a')}
            </p>

            {/* Customer */}
            <section aria-labelledby="modal-customer-heading">
              <p
                id="modal-customer-heading"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2"
              >
                Customer
              </p>
              <p className="font-medium text-foreground">
                {selectedOrder.customer?.name || selectedOrder.guestInfo?.name || 'Guest'}
              </p>
              <p className="text-sm text-muted-foreground">
                {selectedOrder.customer?.phone || selectedOrder.guestInfo?.phone}
              </p>
            </section>

            {/* Items */}
            <section aria-labelledby="modal-items-heading">
              <p
                id="modal-items-heading"
                className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-2"
              >
                Items
              </p>
              <ul className="space-y-2" aria-label="Order items">
                {selectedOrder.items?.map((item, i) => (
                  <li key={i} className="flex justify-between text-sm">
                    <span className="text-foreground">
                      {item.quantity}× {item.name}
                      {item.variant && (
                        <span className="text-muted-foreground"> ({item.variant.name})</span>
                      )}
                      {item.planMeal?.applied && (
                        <span className="ml-1 text-xs bg-green-100 text-green-700 px-1.5 py-0.5"
                          style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                        >Free</span>
                      )}
                    </span>
                    <span className="font-medium text-foreground">
                      Rs. {item.totalPrice?.toLocaleString()}
                    </span>
                  </li>
                ))}
              </ul>
            </section>

            {/* Totals */}
            <div className="border-t border-border pt-3 space-y-1.5 text-sm">
              <div className="flex justify-between text-muted-foreground">
                <span>Subtotal</span>
                <span>Rs. {selectedOrder.subtotal?.toLocaleString()}</span>
              </div>
              {selectedOrder.deliveryFee > 0 && (
                <div className="flex justify-between text-muted-foreground">
                  <span>Delivery fee</span>
                  <span>Rs. {selectedOrder.deliveryFee}</span>
                </div>
              )}
              {selectedOrder.couponDiscount > 0 && (
                <div className="flex justify-between text-green-600">
                  <span>Coupon ({selectedOrder.couponCode})</span>
                  <span>- Rs. {selectedOrder.couponDiscount}</span>
                </div>
              )}
              <div className="flex justify-between font-bold text-foreground pt-1 border-t border-border">
                <span>Total</span>
                <span>Rs. {selectedOrder.totalAmount?.toLocaleString()}</span>
              </div>
            </div>

            {/* Status + next action */}
            <div className="flex items-center justify-between pt-2">
              <StatusBadge status={selectedOrder.status} size="md" />
              {NEXT_STATUS[selectedOrder.status] && (
                <Button
                  style={{
                    backgroundColor: 'var(--gs-admin-accent)',
                    color: 'var(--gs-admin-accent-foreground)',
                  }}
                  aria-label={NEXT_LABEL[selectedOrder.status]}
                  aria-busy={updateStatus.isPending}
                  onClick={() => updateStatus.mutate({
                    id: selectedOrder._id,
                    status: NEXT_STATUS[selectedOrder.status]
                  })}
                  disabled={updateStatus.isPending}
                  className="gs-admin-focus-ring"
                >
                  {updateStatus.isPending && (
                    <Spinner size="sm" label="Updating…" className="mr-2" />
                  )}
                  {NEXT_LABEL[selectedOrder.status]}
                </Button>
              )}
            </div>

            {/* Celebration details — semantic purple preserved */}
            {selectedOrder.orderType === 'celebration' && selectedOrder.celebrationDetails && (
              <div className="bg-purple-50 p-3" style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}>
                <p className="text-xs font-medium text-purple-700 mb-1">Celebration Details</p>
                <div className="text-sm text-purple-600 space-y-1 mt-2">
                  <p><strong>Type:</strong> {selectedOrder.celebrationDetails.celebrationType}</p>
                  <p><strong>Date:</strong> {selectedOrder.celebrationDetails.eventDate
                    ? format(new Date(selectedOrder.celebrationDetails.eventDate), 'MMM d, yyyy')
                    : 'N/A'}
                  </p>
                  {selectedOrder.celebrationDetails.eventTime && (
                    <p><strong>Time:</strong> {selectedOrder.celebrationDetails.eventTime}</p>
                  )}
                  <p><strong>Advance Paid:</strong> Rs. {selectedOrder.celebrationDetails.advanceAmount?.toLocaleString()}</p>
                  <p><strong>Balance Due:</strong> Rs. {selectedOrder.celebrationDetails.balanceAmount?.toLocaleString()}</p>
                </div>
              </div>
            )}

            {/* Special instructions — semantic amber preserved */}
            {selectedOrder.specialInstructions && (
              <div className="bg-amber-50 p-3" style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}>
                <p className="text-xs font-medium text-amber-700 mb-1">Special Instructions</p>
                <p className="text-sm text-amber-600">{selectedOrder.specialInstructions}</p>
              </div>
            )}

            {/* Delivery address */}
            {selectedOrder.deliveryAddress && (
              <section aria-labelledby="modal-address-heading">
                <p
                  id="modal-address-heading"
                  className="text-xs font-medium text-muted-foreground uppercase tracking-wide mb-1"
                >
                  Delivery Address
                </p>
                <p className="text-sm text-muted-foreground">
                  {selectedOrder.deliveryAddress.street}
                  {selectedOrder.deliveryAddress.area && `, ${selectedOrder.deliveryAddress.area}`}
                  {selectedOrder.deliveryAddress.city && `, ${selectedOrder.deliveryAddress.city}`}
                </p>
              </section>
            )}
          </div>
        )}
      </Modal>
    </main>
  )
}