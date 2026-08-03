import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getSessions, createSession, updateSession, deleteSession, getAvailableItems } from '@/api/admin'
import { toast } from 'sonner'
import { Plus, Pencil, Trash2, Clock } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'

/**
 * SessionsPage — Design System: Phase 5.5
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 -> bg-muted
 *  - border-gray-100/200 -> border-border
 *  - divide-gray-50 -> divide-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500/400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Inline status badge -> <StatusBadge />
 *  - Empty sessions view -> <EmptyState />
 *  - Inline SessionModal shell -> <Modal size="lg">
 *  - orange buttons / text / badge -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-lg -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Special sessions management">
 *  - Header landmark
 *  - Section landmark per session card with role="region" aria-label
 *  - Date filter input with <Label htmlFor>
 *  - Form controls inside modal have proper labels & aria-required
 *  - Decorative icons get aria-hidden="true"
 *  - Action buttons get clear aria-label and aria-busy attributes
 */

function SessionModal({ session, onClose, onSave }) {
  const [form, setForm] = useState({
    name: session?.name || '',
    displayName: session?.displayName || '',
    tagline: session?.tagline || '',
    startHour: session?.startHour ?? 12,
    endHour: session?.endHour ?? 16,
    discountPercent: session?.discountPercent || 20,
    activeDate: session?.activeDate || new Date().toISOString().split('T')[0],
    items: session?.items?.map((i) => i._id || i) || [],
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const { data: availableItems = [] } = useQuery({
    queryKey: ['availableItems'],
    queryFn: () => getAvailableItems().then((r) => r.data.items || []),
  })

  const toggleItem = (id) => {
    setForm((f) => ({
      ...f,
      items: f.items.includes(id) ? f.items.filter((i) => i !== id) : [...f.items, id],
    }))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.name.trim()) return toast.error('Name is required')
    if (!form.displayName.trim()) return toast.error('Display name is required')
    if (form.items.length === 0) return toast.error('Select at least one item')
    if (form.startHour === form.endHour) return toast.error('Start and end hour must differ')
    setLoading(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save session')
    } finally {
      setLoading(false)
    }
  }

  const hours = Array.from({ length: 24 }, (_, i) => i)

  return (
    <Modal
      open
      onClose={onClose}
      title={session ? 'Edit Session' : 'New Special Session'}
      size="lg"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label={session ? 'Edit special session form' : 'New special session form'}
      >
        <div className="grid grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label htmlFor="session-name">Session Name * (internal)</Label>
            <Input
              id="session-name"
              name="name"
              required
              aria-required="true"
              value={form.name}
              onChange={(e) => set('name', e.target.value)}
              placeholder="e.g. Khaja Time"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="display-name">Display Name * (shown to customers)</Label>
            <Input
              id="display-name"
              name="displayName"
              required
              aria-required="true"
              value={form.displayName}
              onChange={(e) => set('displayName', e.target.value)}
              placeholder="e.g. Khaja Time Deals 🔥"
            />
          </div>
          <div className="col-span-2 space-y-1.5">
            <Label htmlFor="tagline">Tagline (optional)</Label>
            <Input
              id="tagline"
              name="tagline"
              value={form.tagline}
              onChange={(e) => set('tagline', e.target.value)}
              placeholder="e.g. Limited time afternoon specials!"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="start-hour">Start Hour (NPT) *</Label>
            <select
              id="start-hour"
              name="startHour"
              required
              aria-required="true"
              value={form.startHour}
              onChange={(e) => set('startHour', Number(e.target.value))}
              className="w-full h-9 border border-border bg-card text-foreground px-3 text-sm outline-none gs-admin-focus-ring"
              style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="end-hour">End Hour (NPT) *</Label>
            <select
              id="end-hour"
              name="endHour"
              required
              aria-required="true"
              value={form.endHour}
              onChange={(e) => set('endHour', Number(e.target.value))}
              className="w-full h-9 border border-border bg-card text-foreground px-3 text-sm outline-none gs-admin-focus-ring"
              style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
            >
              {hours.map((h) => (
                <option key={h} value={h}>
                  {h.toString().padStart(2, '0')}:00
                </option>
              ))}
            </select>
            <p className="text-xs text-muted-foreground/60">
              {form.endHour <= form.startHour
                ? `Crosses midnight: ${form.startHour}:00 → ${form.endHour}:00 next day`
                : `Active: ${form.startHour}:00 – ${form.endHour}:00 NPT`}
            </p>
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="discount">Discount % *</Label>
            <Input
              id="discount"
              name="discountPercent"
              type="number"
              min={1}
              max={50}
              required
              aria-required="true"
              value={form.discountPercent}
              onChange={(e) => set('discountPercent', Number(e.target.value))}
              placeholder="20"
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="active-date">Active Date *</Label>
            <Input
              id="active-date"
              name="activeDate"
              type="date"
              required
              aria-required="true"
              value={form.activeDate}
              onChange={(e) => set('activeDate', e.target.value)}
            />
          </div>
        </div>

        {/* Item selection */}
        <fieldset className="border-0 p-0 m-0 space-y-2">
          <legend>
            <Label>Select Items ({form.items.length} selected) *</Label>
          </legend>
          <div
            className="border border-border rounded-lg max-h-56 overflow-y-auto divide-y divide-border bg-card"
            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
          >
            {availableItems.length === 0 ? (
              <p className="text-sm text-muted-foreground p-4 text-center">No menu items available</p>
            ) : (
              availableItems.map((item) => (
                <div key={item._id} className="flex items-center gap-3 px-4 py-2.5 hover:bg-muted transition-colors">
                  <input
                    id={`item-${item._id}`}
                    name="items"
                    type="checkbox"
                    checked={form.items.includes(item._id)}
                    onChange={() => toggleItem(item._id)}
                    className="rounded cursor-pointer"
                  />
                  <Label htmlFor={`item-${item._id}`} className="flex items-center gap-3 cursor-pointer flex-1">
                    {item.image?.url && (
                      <img
                        src={item.image.url}
                        alt=""
                        className="w-7 h-7 object-cover"
                        style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                      />
                    )}
                    <span className="text-sm text-foreground">{item.name}</span>
                    <span className="text-xs text-muted-foreground/60">Rs. {item.basePrice}</span>
                  </Label>
                </div>
              ))
            )}
          </div>
        </fieldset>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="outline" className="flex-1 gs-admin-focus-ring" onClick={onClose}>
            Cancel
          </Button>
          <Button
            type="submit"
            className="flex-1 gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            disabled={loading}
            aria-busy={loading}
          >
            {loading && <Spinner size="sm" label="Saving session..." className="mr-2" />}
            {session ? 'Save Changes' : 'Create Session'}
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function SessionsPage() {
  const queryClient = useQueryClient()
  const [modal, setModal] = useState(null)
  const [dateFilter, setDateFilter] = useState(new Date().toISOString().split('T')[0])

  const { data, isLoading } = useQuery({
    queryKey: ['sessions', dateFilter],
    queryFn: () => getSessions({ date: dateFilter }).then((r) => r.data.sessions || []),
  })

  const sessions = data || []

  const createSess = useMutation({
    mutationFn: (data) => createSession(data),
    onSuccess: () => { queryClient.invalidateQueries(['sessions']); toast.success('Session created') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })
  const updateSess = useMutation({
    mutationFn: ({ id, data }) => updateSession(id, data),
    onSuccess: () => { queryClient.invalidateQueries(['sessions']); toast.success('Session updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })
  const deleteSess = useMutation({
    mutationFn: (id) => deleteSession(id),
    onSuccess: () => { queryClient.invalidateQueries(['sessions']); toast.success('Session deactivated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const formatHour = (h) => `${h.toString().padStart(2, '0')}:00`

  return (
    <main className="space-y-5" aria-label="Special sessions management">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Special Sessions</h1>
          <p className="text-muted-foreground text-sm mt-1">Manage offers and time-based deals</p>
        </div>
        <Button
          aria-label="Create new special session"
          className="gs-admin-focus-ring"
          style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
          onClick={() => setModal({})}
        >
          <Plus size={16} className="mr-2" aria-hidden="true" /> New Session
        </Button>
      </header>

      {/* Date filter */}
      <section className="flex items-center gap-3" aria-label="Filter sessions by date">
        <Label htmlFor="date-filter" className="text-sm text-foreground">Showing sessions for:</Label>
        <Input
          id="date-filter"
          name="dateFilter"
          type="date"
          value={dateFilter}
          onChange={(e) => setDateFilter(e.target.value)}
          className="w-44 h-8"
        />
      </section>

      {/* Sessions list */}
      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading sessions..." />
        </div>
      ) : sessions.length === 0 ? (
        <EmptyState
          icon={Clock}
          message={`No sessions for ${dateFilter}`}
          sub="Create a session to schedule special offers."
          actionLabel="Create one"
          onAction={() => setModal({})}
        />
      ) : (
        <div className="grid gap-4">
          {sessions.map((session) => (
            <section
              key={session._id}
              role="region"
              aria-label={`Special session ${session.displayName}`}
              className="bg-card border border-border p-5"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div className="flex items-start justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <h3 className="font-semibold text-foreground">{session.displayName}</h3>
                    <StatusBadge status={session.isActive ? 'active' : 'inactive'} size="sm" />
                  </div>
                  {session.tagline && (
                    <p className="text-sm text-muted-foreground mt-0.5">{session.tagline}</p>
                  )}
                  <div className="flex items-center gap-4 mt-2 text-sm text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Clock size={13} aria-hidden="true" />
                      {formatHour(session.startHour)} – {formatHour(session.endHour)} NPT
                      {session.endHour <= session.startHour && ' (crosses midnight)'}
                    </span>
                    <span
                      className="font-medium"
                      style={{ color: 'var(--gs-admin-accent)' }}
                    >
                      {session.discountPercent}% off
                    </span>
                    <span>{session.items?.length || 0} items</span>
                  </div>
                </div>
                <div className="flex gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 gs-admin-focus-ring"
                    aria-label={`Edit session ${session.displayName}`}
                    onClick={() => setModal(session)}
                  >
                    <Pencil size={13} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-7 px-2 text-red-500 hover:text-red-600 gs-admin-focus-ring"
                    aria-label={`Deactivate session ${session.displayName}`}
                    aria-busy={deleteSess.isPending}
                    onClick={() => {
                      if (window.confirm(`Deactivate "${session.displayName}"?`)) deleteSess.mutate(session._id)
                    }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </Button>
                </div>
              </div>

              {/* Items preview */}
              {session.items?.length > 0 && (
                <div className="mt-3 flex flex-wrap gap-2">
                  {session.items.slice(0, 6).map((item) => (
                    <div
                      key={item._id || item}
                      className="flex items-center gap-1.5 px-2.5 py-1"
                      style={{
                        backgroundColor: 'var(--gs-admin-accent-muted)',
                        borderRadius: 'var(--gs-admin-radius-lg)',
                      }}
                    >
                      {item.image?.url && (
                        <img
                          src={item.image.url}
                          alt=""
                          className="w-4 h-4 object-cover"
                          style={{ borderRadius: 'var(--gs-admin-radius-sm)' }}
                        />
                      )}
                      <span
                        className="text-xs font-medium"
                        style={{ color: 'var(--gs-admin-accent)' }}
                      >
                        {item.name}
                      </span>
                      {item.basePrice && (
                        <span className="text-xs text-muted-foreground/60 line-through">Rs.{item.basePrice}</span>
                      )}
                      {item.basePrice && (
                        <span
                          className="text-xs font-medium"
                          style={{ color: 'var(--gs-admin-accent)' }}
                        >
                          Rs.{Math.round(item.basePrice * (1 - session.discountPercent / 100))}
                        </span>
                      )}
                    </div>
                  ))}
                  {session.items.length > 6 && (
                    <span className="text-xs text-muted-foreground/60 px-2 py-1">
                      +{session.items.length - 6} more
                    </span>
                  )}
                </div>
              )}
            </section>
          ))}
        </div>
      )}

      {modal !== null && (
        <SessionModal
          session={modal._id ? modal : null}
          onClose={() => setModal(null)}
          onSave={(data) =>
            modal._id
              ? updateSess.mutateAsync({ id: modal._id, data })
              : createSess.mutateAsync(data)
          }
        />
      )}
    </main>
  )
}