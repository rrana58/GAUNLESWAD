import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getClosedDates, createClosedDate, deleteClosedDate } from '@/api/admin'
import { toast } from 'sonner'
import { Plus, Trash2, CalendarX, Bell } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

/**
 * ClosedDatesPage — Design System: Phase 5.6
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500 / text-gray-400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Empty state -> <EmptyState />
 *  - Custom ClosedDateModal overlay -> <Modal size="sm">
 *  - Brand orange -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-lg / rounded-2xl -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Closed dates management">
 *  - Header landmark
 *  - Form controls with id & htmlFor
 *  - Decorative icons with aria-hidden="true"
 *  - Buttons with descriptive aria-label and focus ring
 */

function ClosedDateModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    date: '',
    reason: '',
    adminNote: '',
    notifyDaysBefore: 1,
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.date) return toast.error('Date is required')
    if (!form.reason.trim()) return toast.error('Reason is required')
    setLoading(true)
    try {
      await onSave(form)
      onClose()
    } catch (err) {
      toast.error(err.response?.data?.message || 'Failed to save')
    } finally {
      setLoading(false)
    }
  }

  return (
    <Modal
      open
      onClose={onClose}
      title="Mark Closed Date"
      size="sm"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label="Mark closed date form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="date-input">Date *</Label>
          <Input
            id="date-input"
            name="date"
            type="date"
            required
            aria-required="true"
            value={form.date}
            onChange={(e) => set('date', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="reason-input">Reason * (shown to customers)</Label>
          <Input
            id="reason-input"
            name="reason"
            required
            aria-required="true"
            value={form.reason}
            onChange={(e) => set('reason', e.target.value)}
            placeholder="e.g. Dashain Holiday, Staff Day Off"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="admin-note-input">Admin Note (internal only)</Label>
          <Input
            id="admin-note-input"
            name="adminNote"
            value={form.adminNote}
            onChange={(e) => set('adminNote', e.target.value)}
            placeholder="Optional internal note"
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="notify-days-select">Notify customers how many days before?</Label>
          <select
            id="notify-days-select"
            name="notifyDaysBefore"
            value={form.notifyDaysBefore}
            onChange={(e) => set('notifyDaysBefore', Number(e.target.value))}
            className="w-full h-9 border border-border bg-card text-foreground px-3 text-sm outline-none gs-admin-focus-ring"
            style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
          >
            {[0, 1, 2, 3, 5, 7].map((d) => (
              <option key={d} value={d}>
                {d === 0 ? 'Same day only' : `${d} day${d > 1 ? 's' : ''} before`}
              </option>
            ))}
          </select>
          <p className="text-xs text-muted-foreground/60">
            A push notification and SMS will be sent to all customers {form.notifyDaysBefore} day{form.notifyDaysBefore !== 1 ? 's' : ''} before the closure.
          </p>
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
            {loading && <Spinner size="sm" label="Saving closed date..." className="mr-2" />}
            Mark as Closed
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function ClosedDatesPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['closedDates'],
    queryFn: () => getClosedDates().then((r) => r.data.closedDates || []),
  })

  const closedDates = data || []

  const createCD = useMutation({
    mutationFn: (data) => createClosedDate(data),
    onSuccess: () => { queryClient.invalidateQueries(['closedDates']); toast.success('Closed date added') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const deleteCD = useMutation({
    mutationFn: (id) => deleteClosedDate(id),
    onSuccess: () => { queryClient.invalidateQueries(['closedDates']); toast.success('Removed — kitchen is open again that day') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const today = new Date().toISOString().split('T')[0]
  const upcoming = closedDates.filter((d) => d.date >= today)
  const past = closedDates.filter((d) => d.date < today)

  return (
    <main className="space-y-5" aria-label="Closed dates management">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Closed Dates</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Mark holidays and festivals — orders will be blocked and customers notified
          </p>
        </div>
        <Button
          aria-label="Add new closed date"
          className="gs-admin-focus-ring"
          style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="mr-2" aria-hidden="true" /> Add Closed Date
        </Button>
      </header>

      <section
        aria-label="Notification info"
        className="bg-amber-50 border border-amber-100 p-4 flex gap-3"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <Bell size={18} className="text-amber-500 shrink-0 mt-0.5" aria-hidden="true" />
        <div>
          <p className="text-sm font-medium text-amber-800">How notifications work</p>
          <p className="text-xs text-amber-600 mt-0.5">
            Every morning at 8:00 AM NPT, the system checks for upcoming closures and automatically sends
            push notifications and SMS to all customers the specified number of days in advance.
          </p>
        </div>
      </section>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading closed dates..." />
        </div>
      ) : (
        <div className="space-y-6">
          <section aria-label="Upcoming closures">
            <h2 className="text-sm font-semibold text-muted-foreground uppercase tracking-wide mb-3">
              Upcoming ({upcoming.length})
            </h2>
            {upcoming.length === 0 ? (
              <EmptyState
                icon={CalendarX}
                message="No upcoming closures"
                sub="Your kitchen is operating normally with no scheduled days off."
              />
            ) : (
              <div className="space-y-3">
                {upcoming.map((cd) => (
                  <article
                    key={cd._id}
                    className="bg-card border border-border p-4 flex items-center gap-4"
                    style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                  >
                    <div
                      className="bg-red-50 p-3 shrink-0 text-center min-w-14"
                      style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
                    >
                      <p className="text-xs text-red-400 font-medium">
                        {format(new Date(cd.date + 'T00:00:00'), 'MMM')}
                      </p>
                      <p className="text-2xl font-bold text-red-500 leading-none">
                        {format(new Date(cd.date + 'T00:00:00'), 'd')}
                      </p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-medium text-foreground">{cd.reason}</p>
                      <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground/60">
                        <span>{format(new Date(cd.date + 'T00:00:00'), 'EEEE, MMMM d yyyy')}</span>
                        {cd.notifyDaysBefore > 0 && (
                          <span className="flex items-center gap-1">
                            <Bell size={10} aria-hidden="true" />
                            Notify {cd.notifyDaysBefore}d before
                            {cd.notificationSentAt && ' ✓ sent'}
                          </span>
                        )}
                      </div>
                      {cd.adminNote && (
                        <p className="text-xs text-muted-foreground/60 mt-1 italic">{cd.adminNote}</p>
                      )}
                    </div>
                    <Button
                      variant="ghost"
                      size="sm"
                      aria-label={`Delete closed date ${cd.date}`}
                      aria-busy={deleteCD.isPending}
                      className="h-7 px-2 text-red-500 hover:text-red-600 shrink-0 gs-admin-focus-ring"
                      onClick={() => {
                        if (window.confirm(`Remove closure for ${cd.date}?`)) deleteCD.mutate(cd._id)
                      }}
                    >
                      <Trash2 size={13} aria-hidden="true" />
                    </Button>
                  </article>
                ))}
              </div>
            )}
          </section>

          {past.length > 0 && (
            <section aria-label="Past closures">
              <h2 className="text-sm font-semibold text-muted-foreground/60 uppercase tracking-wide mb-3">
                Past ({past.length})
              </h2>
              <div className="space-y-2">
                {past.slice(0, 5).map((cd) => (
                  <div
                    key={cd._id}
                    className="bg-card border border-border p-3 flex items-center gap-3 opacity-60"
                    style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
                  >
                    <div className="text-center min-w-12">
                      <p className="text-xs text-muted-foreground/60">
                        {format(new Date(cd.date + 'T00:00:00'), 'MMM d')}
                      </p>
                    </div>
                    <p className="text-sm text-muted-foreground flex-1">{cd.reason}</p>
                  </div>
                ))}
              </div>
            </section>
          )}
        </div>
      )}

      {showModal && (
        <ClosedDateModal
          onClose={() => setShowModal(false)}
          onSave={(data) => createCD.mutateAsync(data)}
        />
      )}
    </main>
  )
}