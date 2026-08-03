import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getCoupons, createCoupon, updateCoupon, deleteCoupon } from '@/api/admin'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Ticket } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'

/**
 * CouponsPage — Design System: Phase 5.6
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500 / text-gray-400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Status badge -> <StatusBadge />
 *  - Empty state -> <EmptyState />
 *  - Custom CouponModal overlay -> <Modal size="md">
 *  - Brand orange -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-lg / rounded-2xl -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Coupons management">
 *  - Header landmark
 *  - Form controls with id and htmlFor & aria-required
 *  - Decorative icons with aria-hidden="true"
 *  - Buttons with descriptive aria-label, focus ring, and aria-busy
 */

const selectCls = `w-full h-9 border border-border bg-card text-foreground px-3 text-sm outline-none gs-admin-focus-ring`
const selectStyle = { borderRadius: 'var(--gs-admin-radius-md)' }

function CouponModal({ coupon, onClose, onSave }) {
  const [form, setForm] = useState({
    code: coupon?.code || '',
    discountType: coupon?.discountType || 'flat',
    discountValue: coupon?.discountValue || '',
    maxDiscount: coupon?.maxDiscount || '',
    minOrderAmount: coupon?.minOrderAmount || 0,
    usageLimit: coupon?.usageLimit || '',
    perUserLimit: coupon?.perUserLimit || 1,
    validFrom: coupon?.validFrom?.split('T')[0] || new Date().toISOString().split('T')[0],
    validUntil: coupon?.validUntil?.split('T')[0] || '',
    isActive: coupon?.isActive ?? true,
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.code.trim()) return toast.error('Coupon code is required')
    if (!form.discountValue) return toast.error('Discount value is required')
    setLoading(true)
    try {
      await onSave({
        ...form,
        code: form.code.toUpperCase().trim(),
        discountValue: Number(form.discountValue),
        maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : undefined,
        minOrderAmount: Number(form.minOrderAmount),
        usageLimit: form.usageLimit ? Number(form.usageLimit) : undefined,
        perUserLimit: Number(form.perUserLimit),
        validUntil: form.validUntil || undefined,
      })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save coupon')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={coupon ? 'Edit Coupon' : 'New Coupon'}
      size="md"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label={coupon ? 'Edit coupon form' : 'New coupon form'}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="coupon-code">Coupon Code *</Label>
            <Input
              id="coupon-code"
              name="code"
              required
              aria-required="true"
              value={form.code}
              onChange={(e) => set('code', e.target.value.toUpperCase())}
              placeholder="e.g. DASHAIN20"
              className="font-mono tracking-wider"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-type">Discount Type *</Label>
            <select
              id="discount-type"
              name="discountType"
              required
              aria-required="true"
              value={form.discountType}
              onChange={(e) => set('discountType', e.target.value)}
              className={selectCls}
              style={selectStyle}
            >
              <option value="flat">Flat (Rs.)</option>
              <option value="percentage">Percentage (%)</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount-value">Discount Value *</Label>
            <Input
              id="discount-value"
              name="discountValue"
              type="number"
              required
              aria-required="true"
              value={form.discountValue}
              onChange={(e) => set('discountValue', e.target.value)}
              placeholder={form.discountType === 'flat' ? '50' : '20'}
            />
          </div>
          {form.discountType === 'percentage' && (
            <div className="space-y-1.5">
              <Label htmlFor="max-discount">Max Discount (Rs.)</Label>
              <Input
                id="max-discount"
                name="maxDiscount"
                type="number"
                value={form.maxDiscount}
                onChange={(e) => set('maxDiscount', e.target.value)}
                placeholder="Optional cap"
              />
            </div>
          )}
          <div className="space-y-1.5">
            <Label htmlFor="min-order">Min Order Amount (Rs.)</Label>
            <Input
              id="min-order"
              name="minOrderAmount"
              type="number"
              value={form.minOrderAmount}
              onChange={(e) => set('minOrderAmount', e.target.value)}
              placeholder="0"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="usage-limit">Total Usage Limit</Label>
            <Input
              id="usage-limit"
              name="usageLimit"
              type="number"
              value={form.usageLimit}
              onChange={(e) => set('usageLimit', e.target.value)}
              placeholder="Unlimited"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="per-user-limit">Per User Limit</Label>
            <Input
              id="per-user-limit"
              name="perUserLimit"
              type="number"
              value={form.perUserLimit}
              onChange={(e) => set('perUserLimit', e.target.value)}
              placeholder="1"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valid-from">Valid From *</Label>
            <Input
              id="valid-from"
              name="validFrom"
              type="date"
              required
              aria-required="true"
              value={form.validFrom}
              onChange={(e) => set('validFrom', e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="valid-until">Valid Until</Label>
            <Input
              id="valid-until"
              name="validUntil"
              type="date"
              value={form.validUntil}
              onChange={(e) => set('validUntil', e.target.value)}
            />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <input
            id="is-active"
            name="isActive"
            type="checkbox"
            checked={form.isActive}
            onChange={(e) => set('isActive', e.target.checked)}
            className="rounded cursor-pointer"
          />
          <Label htmlFor="is-active" className="cursor-pointer">Active</Label>
        </div>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 gs-admin-focus-ring" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            className="flex-1 gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Saving coupon..." className="mr-2" />}
            {coupon ? 'Save Changes' : 'Create Coupon'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function CouponsPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)

  const { data, isLoading } = useQuery({
    queryKey: ['coupons'],
    queryFn: () => getCoupons().then((r) => r.data.coupons || []),
  })

  const coupons = data || []

  const createC = useMutation({
    mutationFn: (data) => createCoupon(data),
    onSuccess: () => { queryClient.invalidateQueries(['coupons']); toast.success('Coupon created') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })
  const updateC = useMutation({
    mutationFn: ({ id, data }) => updateCoupon(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['coupons']); toast.success('Coupon updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })
  const deleteC = useMutation({
    mutationFn: (id) => deleteCoupon(id),
    onSuccess: () => { queryClient.invalidateQueries(['coupons']); toast.success('Coupon deleted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  return (
    <main className="space-y-5" aria-label="Coupons management">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Coupons</h1>
          <p className="text-muted-foreground text-sm mt-1">{coupons.length} coupon{coupons.length !== 1 ? 's' : ''}</p>
        </div>
        <Button
          aria-label="Create new coupon"
          className="gs-admin-focus-ring"
          style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
          onClick={() => setModal({})}
        >
          <Plus size={16} className="mr-2" aria-hidden="true" /> New Coupon
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading coupons..." />
        </div>
      ) : coupons.length === 0 ? (
        <EmptyState
          icon={Ticket}
          message="No coupons yet"
          sub="Create a discount coupon for your customers."
          actionLabel="Create one"
          onAction={() => setModal({})}
        />
      ) : (
        <div className="grid gap-3">
          {coupons.map((coupon) => (
            <article
              key={coupon._id}
              className="bg-card border border-border p-4 flex items-center gap-4"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div
                className="border p-3 shrink-0"
                style={{
                  backgroundColor: 'var(--gs-admin-accent-muted)',
                  borderColor: 'var(--gs-admin-accent-muted)',
                  borderRadius: 'var(--gs-admin-radius-lg)',
                }}
              >
                <p
                  className="font-mono font-bold text-sm tracking-wider"
                  style={{ color: 'var(--gs-admin-accent)' }}
                >
                  {coupon.code}
                </p>
              </div>

              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-semibold text-foreground">
                    {coupon.discountType === 'flat'
                      ? `Rs. ${coupon.discountValue} off`
                      : `${coupon.discountValue}% off`}
                  </span>
                  {coupon.maxDiscount && (
                    <span className="text-xs text-muted-foreground/60">max Rs. {coupon.maxDiscount}</span>
                  )}
                  <StatusBadge status={coupon.isActive ? 'active' : 'inactive'} size="sm" />
                </div>
                <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/60 flex-wrap">
                  {coupon.minOrderAmount > 0 && (
                    <span>Min order Rs. {coupon.minOrderAmount}</span>
                  )}
                  {coupon.usageLimit && (
                    <span>{coupon.usedCount || 0}/{coupon.usageLimit} used</span>
                  )}
                  {coupon.validUntil && (
                    <span>Expires {format(new Date(coupon.validUntil), 'MMM d, yyyy')}</span>
                  )}
                  {coupon.perUserLimit && (
                    <span>{coupon.perUserLimit}x per user</span>
                  )}
                </div>
              </div>

              <div className="flex gap-2 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 gs-admin-focus-ring"
                  aria-label={`Edit coupon ${coupon.code}`}
                  onClick={() => setModal(coupon)}
                >
                  <Pencil size={13} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 px-2 text-red-500 hover:text-red-600 gs-admin-focus-ring"
                  aria-label={`Delete coupon ${coupon.code}`}
                  aria-busy={deleteC.isPending}
                  onClick={() => {
                    if (window.confirm(`Delete coupon "${coupon.code}"?`)) deleteC.mutate(coupon._id)
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal !== null && (
        <CouponModal
          coupon={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(data) =>
            modal._id
              ? updateC.mutateAsync({ id: modal._id, data })
              : createC.mutateAsync(data)
          }
        />
      )}
    </main>
  )
}