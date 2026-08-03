import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { getOrders, updateOrderStatus } from '@/api/orders'
import { 
  getCelebrationPackages, createCelebrationPackage, 
  updateCelebrationPackage, deleteCelebrationPackage 
} from '@/api/celebrations'
import { format } from 'date-fns'
import { toast } from 'sonner'
import { Gift, Plus, Pencil, Trash2, MenuSquare, Trash, Eye, RefreshCw } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import FilterChips from '@/components/ui/FilterChips'
import { STATUSES, NEXT_STATUS, NEXT_LABEL } from '@/lib/orderConstants'

/**
 * CelebrationsPage — Design System: Phase 5.6
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 / bg-gray-100 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500 / text-gray-400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Status badges -> <StatusBadge />
 *  - Empty states -> <EmptyState />
 *  - Modals -> <Modal />
 *  - Filter chips -> <FilterChips />
 *  - Pagination -> <Pagination />
 *  - Brand purple/orange -> var(--gs-admin-accent) or semantic purple
 *
 * Accessibility:
 *  - <main aria-label="Celebrations management">
 *  - Header landmark
 *  - Form controls with id and htmlFor
 *  - Decorative icons with aria-hidden="true"
 *  - Buttons with descriptive aria-label, focus ring, and aria-busy
 *  - Tables with scope="col" on <th>
 */

function PackageModal({ pkg, onClose, onSave }) {
  const [form, setForm] = useState({
    name: pkg?.name || '',
    celebrationType: pkg?.celebrationType || '',
    description: pkg?.description || '',
    menus: pkg?.menus?.length ? pkg.menus.map((m) => ({
      _id: m._id,
      name: m.name || '',
      description: m.description || '',
      minPax: m.minPax || 4,
      vegDetails: {
        items: m.vegDetails?.items?.join(', ') || '',
        price: m.vegDetails?.price || '',
      },
      nonVegDetails: {
        items: m.nonVegDetails?.items?.join(', ') || '',
        price: m.nonVegDetails?.price || '',
      },
    })) : [{
      name: '', description: '', minPax: 4,
      vegDetails: { items: '', price: '' },
      nonVegDetails: { items: '', price: '' },
    }],
  })
  const [loading, setLoading] = useState(false)

  const handleMenuChange = (index, field, value, subfield = null) => {
    const updatedMenus = [...form.menus]
    if (subfield) {
      updatedMenus[index][field][subfield] = value
    } else {
      updatedMenus[index][field] = value
    }
    setForm({ ...form, menus: updatedMenus })
  }

  const addMenu = () => {
    setForm({
      ...form,
      menus: [...form.menus, {
        name: '', description: '', minPax: 4,
        vegDetails: { items: '', price: '' },
        nonVegDetails: { items: '', price: '' },
      }],
    })
  }

  const removeMenu = (index) => {
    if (form.menus.length === 1) return toast.error('You must have at least one menu option')
    const updatedMenus = form.menus.filter((_, i) => i !== index)
    setForm({ ...form, menus: updatedMenus })
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name || !form.celebrationType) return toast.error('Name and Type are required')

    for (const menu of form.menus) {
      if (!menu.name) return toast.error('All menu options must have a name')
      if (!menu.vegDetails.price && !menu.nonVegDetails.price) {
        return toast.error(`Menu "${menu.name}" must have at least one pricing (Veg or Non-Veg)`)
      }
    }

    setLoading(true)
    try {
      await onSave({
        name: form.name,
        celebrationType: form.celebrationType,
        description: form.description,
        menus: form.menus.map((menu) => ({
          name: menu.name,
          description: menu.description,
          minPax: Number(menu.minPax) || 4,
          vegDetails: {
            items: menu.vegDetails.items.split(',').map((i) => i.trim()).filter(Boolean),
            price: Number(menu.vegDetails.price) || 0,
          },
          nonVegDetails: {
            items: menu.nonVegDetails.items.split(',').map((i) => i.trim()).filter(Boolean),
            price: Number(menu.nonVegDetails.price) || 0,
          },
        })),
      })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save package')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={pkg ? 'Edit Package' : 'New Package'}
      size="xl"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-6"
        aria-label={pkg ? 'Edit celebration package form' : 'New celebration package form'}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="pkg-name">Package Name *</Label>
            <Input
              id="pkg-name"
              required
              aria-required="true"
              value={form.name}
              onChange={(e) => setForm({ ...form, name: e.target.value })}
              placeholder="e.g. Gaunle Swaad Special"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="pkg-type">Celebration Type *</Label>
            <Input
              id="pkg-type"
              required
              aria-required="true"
              value={form.celebrationType}
              onChange={(e) => setForm({ ...form, celebrationType: e.target.value })}
              placeholder="e.g. Birthday, Anniversary"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="pkg-desc">Description</Label>
            <Input
              id="pkg-desc"
              value={form.description}
              onChange={(e) => setForm({ ...form, description: e.target.value })}
              placeholder="Package description"
            />
          </div>
        </div>

        <div className="border-t border-border pt-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <MenuSquare size={16} className="text-purple-600" aria-hidden="true" /> Menu Options
            </h3>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={addMenu}
              className="gs-admin-focus-ring"
            >
              <Plus size={14} className="mr-2" aria-hidden="true" /> Add Menu Type
            </Button>
          </div>

          <div className="space-y-6">
            {form.menus.map((menu, index) => (
              <fieldset
                key={index}
                className="p-4 bg-muted border border-border space-y-4 relative"
                style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
              >
                <legend className="sr-only">Menu option {index + 1}</legend>
                {form.menus.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeMenu(index)}
                    aria-label={`Remove menu option ${index + 1}`}
                    className="absolute top-4 right-4 text-muted-foreground hover:text-red-500 gs-admin-focus-ring"
                  >
                    <Trash size={16} aria-hidden="true" />
                  </button>
                )}

                <div className="grid grid-cols-2 gap-4 pr-8">
                  <div className="space-y-1.5">
                    <Label htmlFor={`menu-name-${index}`}>Menu Name *</Label>
                    <Input
                      id={`menu-name-${index}`}
                      required
                      aria-required="true"
                      value={menu.name}
                      onChange={(e) => handleMenuChange(index, 'name', e.target.value)}
                      placeholder="e.g. Standard Menu"
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor={`menu-pax-${index}`}>Minimum Pax *</Label>
                    <Input
                      id={`menu-pax-${index}`}
                      type="number"
                      min="1"
                      required
                      aria-required="true"
                      value={menu.minPax}
                      onChange={(e) => handleMenuChange(index, 'minPax', e.target.value)}
                    />
                  </div>
                  <div className="col-span-2 space-y-1.5">
                    <Label htmlFor={`menu-desc-${index}`}>Menu Description</Label>
                    <Input
                      id={`menu-desc-${index}`}
                      value={menu.description}
                      onChange={(e) => handleMenuChange(index, 'description', e.target.value)}
                      placeholder="Optional description for this specific menu"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-2 gap-6 pt-2">
                  <div
                    className="space-y-3 p-3 bg-green-50/50 border border-green-100"
                    style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                  >
                    <h4 className="font-semibold text-green-800 text-sm">Veg Option</h4>
                    <div className="space-y-1.5">
                      <Label htmlFor={`menu-veg-price-${index}`} className="text-xs text-green-700">Price per Person (Rs)</Label>
                      <Input
                        id={`menu-veg-price-${index}`}
                        type="number"
                        value={menu.vegDetails.price}
                        onChange={(e) => handleMenuChange(index, 'vegDetails', e.target.value, 'price')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`menu-veg-items-${index}`} className="text-xs text-green-700">Included Items (comma separated)</Label>
                      <textarea
                        id={`menu-veg-items-${index}`}
                        rows={3}
                        className="w-full border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none gs-admin-focus-ring"
                        style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                        value={menu.vegDetails.items}
                        onChange={(e) => handleMenuChange(index, 'vegDetails', e.target.value, 'items')}
                        placeholder="Paneer Tikka, Dal Makhani..."
                      />
                    </div>
                  </div>

                  <div
                    className="space-y-3 p-3 bg-red-50/50 border border-red-100"
                    style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                  >
                    <h4 className="font-semibold text-red-800 text-sm">Non-Veg Option</h4>
                    <div className="space-y-1.5">
                      <Label htmlFor={`menu-nonveg-price-${index}`} className="text-xs text-red-700">Price per Person (Rs)</Label>
                      <Input
                        id={`menu-nonveg-price-${index}`}
                        type="number"
                        value={menu.nonVegDetails.price}
                        onChange={(e) => handleMenuChange(index, 'nonVegDetails', e.target.value, 'price')}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <Label htmlFor={`menu-nonveg-items-${index}`} className="text-xs text-red-700">Included Items (comma separated)</Label>
                      <textarea
                        id={`menu-nonveg-items-${index}`}
                        rows={3}
                        className="w-full border border-border bg-card text-foreground px-3 py-2 text-sm focus:outline-none gs-admin-focus-ring"
                        style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                        value={menu.nonVegDetails.items}
                        onChange={(e) => handleMenuChange(index, 'nonVegDetails', e.target.value, 'items')}
                        placeholder="Chicken Tikka, Butter Chicken..."
                      />
                    </div>
                  </div>
                </div>
              </fieldset>
            ))}
          </div>
        </div>

        <div className="flex gap-3 pt-4 border-t border-border">
          <Button type="button" variant="outline" className="flex-1 gs-admin-focus-ring" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            className="flex-1 bg-purple-600 hover:bg-purple-700 text-white gs-admin-focus-ring"
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Saving package..." className="mr-2" />}
            {pkg ? 'Save Changes' : 'Create Package'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CelebrationsPage() {
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const [tab, setTab] = useState('orders')
  const [page, setPage] = useState(1)
  const [statusFilter, setStatusFilter] = useState('')
  const [selectedOrder, setSelectedOrder] = useState(null)
  const [packageModal, setPackageModal] = useState(null)

  const { data: ordersData, isLoading: ordersLoading, refetch } = useQuery({
    queryKey: ['orders', 'celebration', page, statusFilter],
    queryFn: () => getOrders({
      page,
      limit: 20,
      orderType: 'celebration',
      ...(statusFilter && { status: statusFilter }),
    }).then((r) => r.data),
    refetchInterval: tab === 'orders' ? 30000 : false,
  })

  const { data: packagesData, isLoading: packagesLoading } = useQuery({
    queryKey: ['celebration-packages'],
    queryFn: () => getCelebrationPackages().then((r) => r.data.packages),
  })

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => updateOrderStatus(id, status),
    onSuccess: () => {
      toast.success('Order status updated')
      queryClient.invalidateQueries(['orders', 'celebration'])
      setSelectedOrder(null)
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Update failed'),
  })

  const createPackage = useMutation({
    mutationFn: (data) => createCelebrationPackage(data),
    onSuccess: () => { queryClient.invalidateQueries(['celebration-packages']); toast.success('Package created') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const updatePackage = useMutation({
    mutationFn: ({ id, data }) => updateCelebrationPackage(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['celebration-packages']); toast.success('Package updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const deletePackage = useMutation({
    mutationFn: (id) => deleteCelebrationPackage(id),
    onSuccess: () => { queryClient.invalidateQueries(['celebration-packages']); toast.success('Package deleted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const orders = ordersData?.orders || []
  const totalPages = ordersData?.totalPages || 1
  const totalOrders = ordersData?.total || 0
  const packages = packagesData || []

  return (
    <main className="space-y-5" aria-label="Celebrations management">
      {/* Header */}
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground flex items-center gap-2">
            <Gift className="text-purple-600" aria-hidden="true" /> Celebrations
          </h1>
          <p className="text-muted-foreground text-sm mt-1">Manage celebration orders and packages</p>
        </div>
        <div className="flex gap-2">
          {tab === 'orders' ? (
            <Button
              variant="outline"
              size="sm"
              className="gs-admin-focus-ring"
              aria-label="Refresh celebration orders"
              onClick={() => refetch()}
            >
              <RefreshCw size={14} className="mr-2" aria-hidden="true" /> Refresh
            </Button>
          ) : (
            <Button
              className="bg-purple-600 hover:bg-purple-700 text-white gs-admin-focus-ring"
              aria-label="Create new celebration package"
              onClick={() => setPackageModal({})}
            >
              <Plus size={16} className="mr-2" aria-hidden="true" /> New Package
            </Button>
          )}
        </div>
      </header>

      {/* Tabs */}
      <nav
        className="flex gap-1 bg-muted p-1 w-fit"
        style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
        aria-label="Celebration sections"
      >
        {['orders', 'packages'].map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            aria-current={tab === t ? 'page' : undefined}
            className={`px-4 py-1.5 text-sm font-medium transition-colors capitalize gs-admin-focus-ring ${
              tab === t ? 'bg-card text-foreground shadow-sm' : 'text-muted-foreground hover:text-foreground'
            }`}
            style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
          >
            {t}
          </button>
        ))}
      </nav>

      {tab === 'orders' && (
        <>
          {/* Stats/Summary */}
          <section aria-label="Celebration statistics" className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div
              className="bg-card border border-border p-4 shadow-sm flex items-center gap-4"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div
                className="w-12 h-12 bg-purple-100 flex items-center justify-center"
                style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
              >
                <Gift className="text-purple-600" size={24} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Total Celebrations</p>
                <p className="text-2xl font-bold text-foreground">{totalOrders}</p>
              </div>
            </div>
            <div
              className="bg-card border border-border p-4 shadow-sm flex items-center gap-4"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div
                className="w-12 h-12 bg-amber-100 flex items-center justify-center"
                style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
              >
                <Gift className="text-amber-600" size={24} aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm text-muted-foreground font-medium">Active Bookings</p>
                <p className="text-2xl font-bold text-foreground">
                  {orders.filter((o) => ['pending', 'confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(o.status)).length}
                </p>
              </div>
            </div>
          </section>

          {/* Filters */}
          <section
            aria-label="Order status filters"
            className="bg-card border border-border p-4 flex flex-wrap gap-3"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
          >
            <FilterChips
              label="Filter celebration orders by status"
              options={[
                { value: '', label: 'All' },
                ...STATUSES.map((s) => ({ value: s, label: s.replace(/_/g, ' ') })),
              ]}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
            />
          </section>

          {/* Orders table */}
          <section
            className="bg-card border border-border overflow-hidden shadow-sm"
            style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            aria-label="Celebration orders list"
          >
            {ordersLoading ? (
              <div className="flex items-center justify-center h-64">
                <Spinner size="lg" label="Loading celebration orders..." />
              </div>
            ) : orders.length === 0 ? (
              <EmptyState
                icon={Gift}
                message="No celebration orders found"
                sub="Orders for events and parties will appear here."
              />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm" aria-label="Celebration orders">
                  <thead className="bg-muted border-b border-border">
                    <tr className="text-left text-muted-foreground text-xs">
                      <th scope="col" className="px-4 py-3 font-medium">Order #</th>
                      <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                      <th scope="col" className="px-4 py-3 font-medium">Event Details</th>
                      <th scope="col" className="px-4 py-3 font-medium">Advance</th>
                      <th scope="col" className="px-4 py-3 font-medium">Balance</th>
                      <th scope="col" className="px-4 py-3 font-medium">Status</th>
                      <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {orders.map((order) => (
                      <tr key={order._id} className="hover:bg-muted transition-colors">
                        <td className="px-4 py-3 font-mono text-xs">
                          <button
                            onClick={() => navigate(`/orders/${order._id}`)}
                            className="text-muted-foreground hover:text-purple-600 hover:underline gs-admin-focus-ring"
                            aria-label={`View details for order #${order.orderNumber}`}
                          >
                            #{order.orderNumber}
                          </button>
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-foreground">{order.customer?.name || order.guestInfo?.name || 'Guest'}</p>
                          <p className="text-xs text-muted-foreground/60">{order.customer?.phone || order.guestInfo?.phone}</p>
                        </td>
                        <td className="px-4 py-3">
                          {order.celebrationDetails ? (
                            <>
                              <p className="font-medium text-purple-700">{order.celebrationDetails.celebrationType} - {order.celebrationDetails.packageName}</p>
                              <p className="text-xs font-semibold text-foreground mt-0.5">{order.celebrationDetails.menuName}</p>
                              <p className="text-xs text-muted-foreground">
                                {order.celebrationDetails.pax} Pax ({order.celebrationDetails.dietaryPreference})
                              </p>
                              <p className="text-xs text-muted-foreground mt-1">
                                {format(new Date(order.celebrationDetails.eventDate), 'MMM d, yyyy')} 
                                {order.celebrationDetails.eventTime ? ` at ${order.celebrationDetails.eventTime}` : ''}
                              </p>
                            </>
                          ) : (
                            <p className="text-muted-foreground/60">N/A</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          Rs. {order.celebrationDetails?.advanceAmount?.toLocaleString() || 0}
                          <br />
                          <span className="text-[10px] text-muted-foreground capitalize">{order.paymentMethod}</span>
                        </td>
                        <td className="px-4 py-3 font-medium text-foreground">
                          Rs. {order.celebrationDetails?.balanceAmount?.toLocaleString() || 0}
                        </td>
                        <td className="px-4 py-3">
                          <StatusBadge status={order.status} size="sm" />
                        </td>
                        <td className="px-4 py-3">
                          <div className="flex items-center gap-2">
                            <Button
                              variant="ghost"
                              size="sm"
                              className="h-7 px-2 gs-admin-focus-ring"
                              aria-label={`Quick view order #${order.orderNumber}`}
                              onClick={() => setSelectedOrder(order)}
                            >
                              <Eye size={13} aria-hidden="true" />
                            </Button>
                            {NEXT_STATUS[order.status] && (
                              <Button
                                size="sm"
                                className="h-7 px-2 text-xs bg-purple-600 hover:bg-purple-700 text-white gs-admin-focus-ring"
                                aria-label={`Advance order #${order.orderNumber} to ${NEXT_LABEL[order.status]}`}
                                aria-busy={updateStatus.isPending}
                                onClick={() => updateStatus.mutate({ id: order._id, status: NEXT_STATUS[order.status] })}
                                disabled={updateStatus.isPending}
                              >
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

            <Pagination
              page={page}
              totalPages={totalPages}
              total={totalOrders}
              onPage={setPage}
              label="celebration orders"
            />
          </section>
        </>
      )}

      {tab === 'packages' && (
        <section aria-label="Celebration packages list" className="space-y-4">
          {packagesLoading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size="lg" label="Loading celebration packages..." />
            </div>
          ) : packages.length === 0 ? (
            <EmptyState
              icon={Gift}
              message="No celebration packages yet"
              sub="Create packages for birthdays, anniversaries, and events."
              actionLabel="Create Package"
              onAction={() => setPackageModal({})}
            />
          ) : (
            <div className="grid grid-cols-1 gap-4">
              {packages.map((pkg) => (
                <article
                  key={pkg._id}
                  className="bg-card border border-border p-5 shadow-sm"
                  style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                >
                  <div className="flex items-start justify-between mb-4">
                    <div>
                      <span
                        className="text-xs font-semibold text-purple-600 bg-purple-50 px-2 py-0.5 uppercase tracking-wider mb-2 inline-block"
                        style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                      >
                        {pkg.celebrationType}
                      </span>
                      <h3 className="font-semibold text-foreground text-lg">{pkg.name}</h3>
                      {pkg.description && <p className="text-sm text-muted-foreground mt-1">{pkg.description}</p>}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="gs-admin-focus-ring"
                        aria-label={`Edit package ${pkg.name}`}
                        onClick={() => setPackageModal(pkg)}
                      >
                        <Pencil size={14} className="mr-2" aria-hidden="true" /> Edit Package
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-500 hover:text-red-600 hover:bg-red-50 gs-admin-focus-ring"
                        aria-label={`Delete package ${pkg.name}`}
                        aria-busy={deletePackage.isPending}
                        onClick={() => {
                          if (window.confirm(`Delete package "${pkg.name}"?`)) deletePackage.mutate(pkg._id)
                        }}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </Button>
                    </div>
                  </div>

                  {pkg.menus && pkg.menus.length > 0 ? (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      {pkg.menus.map((menu) => (
                        <div
                          key={menu._id}
                          className="border border-border p-4 bg-muted/50"
                          style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                        >
                          <div className="flex justify-between items-start mb-2">
                            <h4 className="font-semibold text-foreground">{menu.name}</h4>
                            <span
                              className="text-xs font-medium bg-muted text-muted-foreground px-2 py-0.5"
                              style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                            >
                              Min Pax: {menu.minPax}
                            </span>
                          </div>
                          {menu.description && <p className="text-xs text-muted-foreground mb-3">{menu.description}</p>}

                          <div className="space-y-3">
                            {menu.vegDetails?.price > 0 && (
                              <div
                                className="bg-green-50/50 p-2.5 border border-green-100"
                                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-bold text-green-700">Veg</span>
                                  <span className="text-xs font-semibold text-foreground">Rs. {menu.vegDetails.price}/pax</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">{menu.vegDetails.items.join(', ')}</p>
                              </div>
                            )}
                            {menu.nonVegDetails?.price > 0 && (
                              <div
                                className="bg-red-50/50 p-2.5 border border-red-100"
                                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                              >
                                <div className="flex justify-between items-center mb-1">
                                  <span className="text-xs font-bold text-red-700">Non-Veg</span>
                                  <span className="text-xs font-semibold text-foreground">Rs. {menu.nonVegDetails.price}/pax</span>
                                </div>
                                <p className="text-xs text-muted-foreground line-clamp-1">{menu.nonVegDetails.items.join(', ')}</p>
                              </div>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  ) : (
                    <p className="text-sm text-muted-foreground/60 italic mt-4">No menus added to this package yet.</p>
                  )}
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      {/* Order detail modal */}
      {selectedOrder && (
        <Modal
          open
          onClose={() => setSelectedOrder(null)}
          title={`Celebration Order #${selectedOrder.orderNumber}`}
          size="md"
        >
          <div className="p-5 space-y-4">
            <div
              className="bg-purple-50 p-4"
              style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
            >
              <p className="text-xs font-medium text-purple-700 mb-2 uppercase tracking-wide">Event Details</p>
              <div className="text-sm text-purple-900 space-y-1.5">
                <p><strong>Package:</strong> {selectedOrder.celebrationDetails?.packageName} ({selectedOrder.celebrationDetails?.celebrationType})</p>
                <p><strong>Menu:</strong> {selectedOrder.celebrationDetails?.menuName}</p>
                <p><strong>Type:</strong> {selectedOrder.celebrationDetails?.dietaryPreference} ({selectedOrder.celebrationDetails?.pax} people)</p>
                <p><strong>Date:</strong> {selectedOrder.celebrationDetails?.eventDate ? format(new Date(selectedOrder.celebrationDetails.eventDate), 'MMM d, yyyy') : 'N/A'}</p>
                <p><strong>Time:</strong> {selectedOrder.celebrationDetails?.eventTime || 'N/A'}</p>
              </div>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide mb-2">Customer</p>
              <p className="font-medium text-foreground">{selectedOrder.customer?.name || selectedOrder.guestInfo?.name || 'Guest'}</p>
              <p className="text-sm text-muted-foreground">{selectedOrder.customer?.phone || selectedOrder.guestInfo?.phone}</p>
            </div>

            <div>
              <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide mb-2">Delivery Location</p>
              {selectedOrder.deliveryType === 'pickup' ? (
                <p className="text-sm font-medium text-foreground">Self Pickup</p>
              ) : (
                <div className="text-sm text-foreground">
                  <p className="font-medium">{selectedOrder.deliveryAddress?.street}</p>
                  <p>{selectedOrder.deliveryAddress?.area}, {selectedOrder.deliveryAddress?.city}</p>
                  {selectedOrder.deliveryAddress?.landmark && (
                    <p className="text-muted-foreground mt-1">Landmark: {selectedOrder.deliveryAddress.landmark}</p>
                  )}
                </div>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <p className="text-xs font-medium text-muted-foreground/60 uppercase tracking-wide mb-2">Payment Summary</p>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-medium">Rs. {selectedOrder.subtotal?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Delivery Fee</span>
                  <span className="font-medium">Rs. {selectedOrder.deliveryFee?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between pt-2 border-t border-border font-semibold text-foreground">
                  <span>Total Amount</span>
                  <span>Rs. {selectedOrder.totalAmount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-purple-700 font-semibold mt-2">
                  <span>Advance Paid ({selectedOrder.paymentMethod})</span>
                  <span>Rs. {selectedOrder.celebrationDetails?.advanceAmount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between text-muted-foreground font-medium">
                  <span>Balance Due</span>
                  <span>Rs. {selectedOrder.celebrationDetails?.balanceAmount?.toLocaleString()}</span>
                </div>
              </div>
            </div>

            {selectedOrder.specialInstructions && (
              <div
                className="bg-amber-50 text-amber-800 p-3 text-sm border border-amber-100"
                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
              >
                <span className="font-semibold block mb-1">Special Instructions:</span>
                {selectedOrder.specialInstructions}
              </div>
            )}
          </div>
        </Modal>
      )}

      {packageModal && (
        <PackageModal
          pkg={Object.keys(packageModal).length > 0 ? packageModal : null}
          onClose={() => setPackageModal(null)}
          onSave={
            Object.keys(packageModal).length > 0
              ? (data) => updatePackage.mutateAsync({ id: packageModal._id, data })
              : (data) => createPackage.mutateAsync(data)
          }
        />
      )}
    </main>
  )
}
