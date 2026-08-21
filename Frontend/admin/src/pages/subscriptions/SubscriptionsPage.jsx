import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import {
  getSubscriptions, confirmSubscription,
  updateSubscriptionStatus, getSubscriptionStats,
  getMealPlans, createMealPlan, updateMealPlan, deleteMealPlan,
  getAvailableItems
} from '@/api/admin'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, CheckCircle, CreditCard } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import Pagination from '@/components/ui/Pagination'
import FilterChips from '@/components/ui/FilterChips'

/**
 * SubscriptionsPage — Design System: Phase 5.6
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
 *  - Brand orange -> var(--gs-admin-accent)
 *
 * Accessibility:
 *  - <main aria-label="Subscriptions management">
 *  - Header landmark
 *  - Form controls with id and htmlFor
 *  - Decorative icons with aria-hidden="true"
 *  - Buttons with descriptive aria-label, focus ring, and aria-busy
 *  - Tables with scope="col" on <th>
 */

function MealPlanModal({ plan, onClose, onSave }) {
  const [form, setForm] = useState({
    name: plan?.name || '',
    description: plan?.description || '',
    pricingOptions: plan?.pricingOptions?.length > 0 ? plan?.pricingOptions : [{ meals: 30, price: '' }],
    items: plan?.items?.map((i) => i._id || i) || [],
  })
  const [loading, setLoading] = useState(false)
  const [itemSearch, setItemSearch] = useState('')
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const { data: availableItems = [] } = useQuery({
    queryKey: ['availableItems'],
    queryFn: () => getAvailableItems().then((r) => r.data.items || []),
  })

  const toggleItem = (id) => {
    setForm((f) => ({
      ...f,
      items: f.items.includes(id)
        ? f.items.filter((i) => i !== id)
        : [...f.items, id],
    }))
  }

  const filteredItems = availableItems.filter((i) =>
    !itemSearch || i.name.toLowerCase().includes(itemSearch.toLowerCase())
  )

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (form.pricingOptions.length === 0) return toast.error('Add at least one pricing option')
    for (const opt of form.pricingOptions) {
      if (!opt.meals || !opt.price) return toast.error('All pricing options must have meals and price')
    }
    if (form.items.length < 2) return toast.error('Select at least 2 items')
    setLoading(true)
    try {
      await onSave({
        ...form,
        pricingOptions: form.pricingOptions.map((o) => ({ meals: Number(o.meals), price: Number(o.price) })),
      })
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save plan')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={plan ? 'Edit Meal Plan' : 'New Meal Plan'}
      size="md"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label={plan ? 'Edit meal plan form' : 'New meal plan form'}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="plan-name">Plan Name *</Label>
            <Input
              id="plan-name"
              required
              aria-required="true"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Monthly Momo Plan"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label>Pricing Options *</Label>
            <div className="space-y-2">
              {form.pricingOptions.map((opt, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                  <Input
                    type="number"
                    aria-label={`Pricing option ${idx + 1} meals count`}
                    value={opt.meals}
                    onChange={(e) => {
                      const newOpts = [...form.pricingOptions]
                      newOpts[idx].meals = e.target.value
                      set('pricingOptions', newOpts)
                    }}
                    placeholder="Meals (e.g. 30)"
                  />
                  <Input
                    type="number"
                    aria-label={`Pricing option ${idx + 1} price`}
                    value={opt.price}
                    onChange={(e) => {
                      const newOpts = [...form.pricingOptions]
                      newOpts[idx].price = e.target.value
                      set('pricingOptions', newOpts)
                    }}
                    placeholder="Price (Rs)"
                  />
                  {form.pricingOptions.length > 1 && (
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="text-red-500 px-2 gs-admin-focus-ring"
                      aria-label={`Remove pricing option ${idx + 1}`}
                      onClick={() => {
                        set('pricingOptions', form.pricingOptions.filter((_, i) => i !== idx))
                      }}
                    >
                      <Trash2 size={16} aria-hidden="true" />
                    </Button>
                  )}
                </div>
              ))}
              <Button
                type="button"
                variant="outline"
                size="sm"
                className="w-full text-xs gs-admin-focus-ring"
                onClick={() => {
                  set('pricingOptions', [...form.pricingOptions, { meals: '', price: '' }])
                }}
              >
                <Plus size={14} className="mr-1" aria-hidden="true" /> Add Option
              </Button>
            </div>
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="plan-desc">Description</Label>
            <Input
              id="plan-desc"
              value={form.description}
              onChange={(e) => set('description', e.target.value)}
              placeholder="What's included in this plan"
            />
          </div>
        </div>

        <fieldset className="border-0 p-0 m-0 space-y-2">
          <legend className="w-full">
            <div className="flex items-center justify-between mb-1">
              <Label>Select Items ({form.items.length} selected — min 2) *</Label>
            </div>
          </legend>
          {availableItems.length > 5 && (
            <Input
              type="search"
              placeholder="Search items..."
              value={itemSearch}
              onChange={(e) => setItemSearch(e.target.value)}
              className="h-8 text-xs mb-2"
            />
          )}
          <div
            className="border border-border rounded-lg max-h-52 overflow-y-auto divide-y divide-border bg-card"
            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
          >
            {filteredItems.length === 0 ? (
              <div className="p-4 text-xs text-center text-muted-foreground">No items match your search.</div>
            ) : (
              filteredItems.map((item) => (
                <label key={item._id} className="flex items-center gap-3 px-4 py-2.5 cursor-pointer hover:bg-muted transition-colors">
                  <input
                    type="checkbox"
                    checked={form.items.includes(item._id)}
                    onChange={() => toggleItem(item._id)}
                    className="rounded cursor-pointer"
                  />
                  {item.image?.url && (
                    <img
                      src={item.image.url}
                      alt=""
                      className="w-7 h-7 object-cover"
                      style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                    />
                  )}
                  <span className="text-sm text-foreground flex-1">{item.name}</span>
                  <span className="text-xs text-muted-foreground/60">Rs. {item.basePrice}</span>
                </label>
              ))
            )}
          </div>
        </fieldset>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 gs-admin-focus-ring" onClick={onClose}>Cancel</Button>
          <Button
            type="submit"
            className="flex-1 gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Saving plan..." className="mr-2" />}
            {plan ? 'Save Changes' : 'Create Plan'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function SubscriptionsPage() {
  const queryClient = useQueryClient()
  const [tab, setTab] = useState('subscriptions')
  const [planModal, setPlanModal] = useState(null)
  const [statusFilter, setStatusFilter] = useState('')
  const [page, setPage] = useState(1)

  const { data: subsData, isLoading: subsLoading } = useQuery({
    queryKey: ['subscriptions', statusFilter, page],
    queryFn: () => getSubscriptions({ status: statusFilter, page, limit: 20 }).then((r) => r.data),
  })

  const { data: plansData } = useQuery({
    queryKey: ['mealPlans'],
    queryFn: () => getMealPlans().then((r) => r.data.plans || r.data.mealPlans || []),
  })

  const { data: statsData } = useQuery({
    queryKey: ['subscriptionStats'],
    queryFn: () => getSubscriptionStats().then((r) => r.data),
  })

  const subscriptions = subsData?.subscriptions || []
  const totalPages = subsData?.totalPages || 1
  const totalSubs = subsData?.total || 0
  const plans = plansData || []

  const confirmSub = useMutation({
    mutationFn: ({ id, paymentReference }) => confirmSubscription(id, { paymentReference }),
    onSuccess: () => { queryClient.invalidateQueries(['subscriptions']); toast.success('Subscription activated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const handleConfirmClick = (sub) => {
    const reference = window.prompt(
      `Confirm ${sub.customer?.name || 'this'} subscription.\n\nEnter the payment reference (Khalti/eSewa transaction ID, bank transfer ID, or cash receipt number):`
    )
    if (!reference || !reference.trim()) return
    confirmSub.mutate({ id: sub._id, paymentReference: reference.trim() })
  }

  const updateStatus = useMutation({
    mutationFn: ({ id, status }) => updateSubscriptionStatus(id, { status }),
    onSuccess: () => { queryClient.invalidateQueries(['subscriptions']); toast.success('Status updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const createPlan = useMutation({
    mutationFn: (data) => createMealPlan(data),
    onSuccess: () => { queryClient.invalidateQueries(['mealPlans']); toast.success('Plan created') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const updatePlan = useMutation({
    mutationFn: ({ id, data }) => updateMealPlan(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['mealPlans']); toast.success('Plan updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const deletePlan = useMutation({
    mutationFn: (id) => deleteMealPlan(id),
    onSuccess: () => { queryClient.invalidateQueries(['mealPlans']); toast.success('Plan deleted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  return (
    <main className="space-y-5" aria-label="Subscriptions management">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Subscriptions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage meal plans and customer subscriptions</p>
        </div>
        {tab === 'plans' && (
          <Button
            aria-label="Create new meal plan"
            className="gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            onClick={() => setPlanModal({})}
          >
            <Plus size={16} className="mr-2" aria-hidden="true" /> New Plan
          </Button>
        )}
      </header>

      {/* Stats */}
      {statsData && (
        <section aria-label="Subscription statistics" className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {statsData.statusBreakdown?.map((s) => (
            <div
              key={s._id}
              className="bg-card border border-border p-4"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <p className="text-xs text-muted-foreground/60 capitalize">{s._id}</p>
              <p className="text-2xl font-bold text-foreground mt-1">{s.count}</p>
              <p className="text-xs text-muted-foreground/60">Rs. {s.revenue?.toLocaleString()}</p>
            </div>
          ))}
        </section>
      )}

      {/* Tabs */}
      <nav
        className="flex gap-1 bg-muted p-1 w-fit"
        style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
        aria-label="Subscription section tabs"
      >
        {['subscriptions', 'plans'].map((t) => (
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

      {/* Subscriptions tab */}
      {tab === 'subscriptions' && (
        <div className="space-y-4">
          <section aria-label="Filter subscriptions by status" className="flex gap-2 flex-wrap">
            <FilterChips
              label="Filter subscriptions"
              options={[
                { value: '', label: 'All' },
                { value: 'pending', label: 'Pending' },
                { value: 'active', label: 'Active' },
                { value: 'paused', label: 'Paused' },
                { value: 'expired', label: 'Expired' },
                { value: 'cancelled', label: 'Cancelled' },
              ]}
              value={statusFilter}
              onChange={(v) => { setStatusFilter(v); setPage(1); }}
            />
          </section>

          {subsLoading ? (
            <div className="flex items-center justify-center h-48">
              <Spinner size="lg" label="Loading subscriptions..." />
            </div>
          ) : subscriptions.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              message="No subscriptions found"
              sub="Customer subscriptions will show up here."
            />
          ) : (
            <section
              className="bg-card border border-border overflow-hidden"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
              aria-label="Subscriptions table"
            >
              <table className="w-full text-sm" aria-label="All customer subscriptions">
                <thead className="bg-muted border-b border-border">
                  <tr className="text-left text-muted-foreground text-xs">
                    <th scope="col" className="px-4 py-3 font-medium">Customer</th>
                    <th scope="col" className="px-4 py-3 font-medium">Plan</th>
                    <th scope="col" className="px-4 py-3 font-medium">Meals</th>
                    <th scope="col" className="px-4 py-3 font-medium">Expires</th>
                    <th scope="col" className="px-4 py-3 font-medium">Status</th>
                    <th scope="col" className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {subscriptions.map((sub) => (
                    <tr key={sub._id} className="hover:bg-muted transition-colors">
                      <td className="px-4 py-3">
                        <p className="font-medium text-foreground">{sub.customer?.name}</p>
                        <p className="text-xs text-muted-foreground/60">{sub.customer?.phone}</p>
                      </td>
                      <td className="px-4 py-3">
                        <p className="text-foreground">{sub.plan?.name}</p>
                        <p className="text-xs text-muted-foreground/60">Rs. {sub.pricePaid?.toLocaleString()}</p>
                      </td>
                      <td className="px-4 py-3 text-muted-foreground">
                        {sub.mealsUsed}/{sub.maxMeals}
                      </td>
                      <td className="px-4 py-3 text-xs text-muted-foreground/60">
                        {sub.endDate ? format(new Date(sub.endDate), 'MMM d, yyyy') : '—'}
                      </td>
                      <td className="px-4 py-3">
                        <StatusBadge status={sub.status} size="sm" />
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex gap-2">
                          {sub.status === 'pending' && (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs bg-green-500 hover:bg-green-600 text-white gs-admin-focus-ring"
                              aria-label={`Confirm subscription for ${sub.customer?.name}`}
                              aria-busy={confirmSub.isPending}
                              onClick={() => handleConfirmClick(sub)}
                              disabled={confirmSub.isPending}
                            >
                              <CheckCircle size={12} className="mr-1" aria-hidden="true" /> Confirm
                            </Button>
                          )}
                          {sub.status === 'active' && (
                            <Button
                              size="sm"
                              variant="outline"
                              className="h-7 px-2 text-xs gs-admin-focus-ring"
                              aria-label={`Pause subscription for ${sub.customer?.name}`}
                              aria-busy={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: sub._id, status: 'paused' })}
                            >
                              Pause
                            </Button>
                          )}
                          {sub.status === 'paused' && (
                            <Button
                              size="sm"
                              className="h-7 px-2 text-xs gs-admin-focus-ring"
                              style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
                              aria-label={`Resume subscription for ${sub.customer?.name}`}
                              aria-busy={updateStatus.isPending}
                              onClick={() => updateStatus.mutate({ id: sub._id, status: 'active' })}
                            >
                              Resume
                            </Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>

              <Pagination
                page={page}
                totalPages={totalPages}
                total={totalSubs}
                onPage={setPage}
                label="subscriptions"
              />
            </section>
          )}
        </div>
      )}

      {/* Plans tab */}
      {tab === 'plans' && (
        <section aria-label="Meal plans list" className="space-y-3">
          {plans.length === 0 ? (
            <EmptyState
              icon={CreditCard}
              message="No meal plans yet"
              sub="Create recurring meal subscription plans for customers."
              actionLabel="Create one"
              onAction={() => setPlanModal({})}
            />
          ) : plans.map((plan) => (
            <article
              key={plan._id}
              className="bg-card border border-border p-5"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <h3 className="font-semibold text-foreground">{plan.name}</h3>
                  {plan.description && <p className="text-sm text-muted-foreground/60 mt-0.5">{plan.description}</p>}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    {plan.pricingOptions && plan.pricingOptions.length > 0 && (
                      <span
                        className="font-semibold"
                        style={{ color: 'var(--gs-admin-accent)' }}
                      >
                        Rs. {Math.min(...plan.pricingOptions.map((o) => o.price)).toLocaleString()}
                        {plan.pricingOptions.length > 1 ? ` - ${Math.max(...plan.pricingOptions.map((o) => o.price)).toLocaleString()}` : ''}
                      </span>
                    )}
                    <span>{plan.pricingOptions?.map((o) => o.meals).join(', ')} meals</span>
                    <span>{plan.items?.length || 0} items</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gs-admin-focus-ring"
                    aria-label={`Edit meal plan ${plan.name}`}
                    onClick={() => setPlanModal(plan)}
                  >
                    <Pencil size={13} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-500 hover:text-red-600 gs-admin-focus-ring"
                    aria-label={`Delete meal plan ${plan.name}`}
                    aria-busy={deletePlan.isPending}
                    onClick={() => {
                      if (window.confirm(`Delete "${plan.name}"?`)) deletePlan.mutate(plan._id)
                    }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </Button>
                </div>
              </div>
              {plan.items?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-1.5">
                  {plan.items.slice(0, 8).map((item) => (
                    <span
                      key={item._id || item}
                      className="text-xs bg-muted text-muted-foreground px-2 py-0.5"
                      style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                    >
                      {item.name || item}
                    </span>
                  ))}
                  {plan.items.length > 8 && (
                    <span className="text-xs text-muted-foreground/60 px-2 py-0.5">+{plan.items.length - 8} more</span>
                  )}
                </div>
              )}
            </article>
          ))}
        </section>
      )}

      {planModal !== null && (
        <MealPlanModal
          plan={planModal._id ? planModal : null}
          onClose={() => setPlanModal(null)}
          onSave={(data) =>
            planModal._id
              ? updatePlan.mutateAsync({ id: planModal._id, data })
              : createPlan.mutateAsync(data)
          }
        />
      )}
    </main>
  )
}
