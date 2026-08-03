import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getAnnouncements, createAnnouncement, updateAnnouncement, deleteAnnouncement, sendBroadcast } from '@/api/admin'
import { toast } from 'sonner'
import { Plus, Trash2, Megaphone, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

/**
 * AnnouncementsPage — Design System: Phase 5.6
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 / bg-gray-100 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500 / text-gray-400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Empty state container -> <EmptyState />
 *  - Custom AnnouncementModal overlay -> <Modal size="sm">
 *  - Brand orange -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-lg / rounded-full -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Announcements management">
 *  - Header landmark
 *  - Form controls with id and htmlFor
 *  - Decorative icons with aria-hidden="true"
 *  - Buttons with descriptive aria-label, focus ring, and aria-busy
 */

function AnnouncementModal({ onClose, onSave }) {
  const [form, setForm] = useState({ title: '', body: '', expiresAt: '', sendPush: false })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    if (!form.body.trim()) return toast.error('Body is required')
    setLoading(true)
    try {
      await onSave({ ...form, expiresAt: form.expiresAt || undefined })
      if (form.sendPush) {
        await sendBroadcast({ title: form.title, body: form.body }).catch(() => toast.error('Failed to send push broadcast'))
        toast.success('Push notification broadcast sent!')
      }
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
      title="Post Announcement"
      size="sm"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label="Post announcement form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="ann-title">Title *</Label>
          <Input
            id="ann-title"
            required
            aria-required="true"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. New branch opening soon!"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ann-body">Body *</Label>
          <textarea
            id="ann-body"
            required
            aria-required="true"
            value={form.body}
            onChange={(e) => set('body', e.target.value)}
            placeholder="Full announcement text shown to customers"
            maxLength={1000}
            rows={5}
            className="w-full border border-border bg-card text-foreground px-3 py-2 text-sm resize-none focus:outline-none gs-admin-focus-ring transition-colors"
            style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
          />
          <p className="text-xs text-muted-foreground/60 text-right">{form.body.length}/1000</p>
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="ann-expires">Expires on (optional)</Label>
          <Input
            id="ann-expires"
            type="date"
            value={form.expiresAt}
            onChange={(e) => set('expiresAt', e.target.value)}
            min={new Date().toISOString().split('T')[0]}
          />
          <p className="text-xs text-muted-foreground/60">Leave blank to keep it up until you remove it manually.</p>
        </div>
        <div className="flex items-center gap-2 pt-2">
          <input
            type="checkbox"
            id="ann-push"
            checked={form.sendPush}
            onChange={(e) => set('sendPush', e.target.checked)}
            className="rounded cursor-pointer w-4 h-4"
          />
          <Label htmlFor="ann-push" className="cursor-pointer">Also send as a Push Notification broadcast to all users</Label>
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
            {loading && <Spinner size="sm" label="Posting announcement..." className="mr-2" />}
            Post
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function AnnouncementsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['announcements'],
    queryFn: () => getAnnouncements().then((r) => r.data.announcements || []),
  })

  const announcements = data || []
  const invalidate = () => queryClient.invalidateQueries(['announcements'])

  const createMut = useMutation({
    mutationFn: (data) => createAnnouncement(data),
    onSuccess: () => { invalidate(); toast.success('Announcement posted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }) => updateAnnouncement(id, { isActive }),
    onSuccess: () => { invalidate(); toast.success('Updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteAnnouncement(id),
    onSuccess: () => { invalidate(); toast.success('Deleted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  return (
    <main className="space-y-5" aria-label="Announcements management">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Announcements</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Text notices shown to every customer in the app's More tab
          </p>
        </div>
        <Button
          aria-label="Post new announcement"
          className="gs-admin-focus-ring"
          style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
          onClick={() => setShowModal(true)}
        >
          <Plus size={16} className="mr-2" aria-hidden="true" /> New Announcement
        </Button>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading announcements..." />
        </div>
      ) : announcements.length === 0 ? (
        <EmptyState
          icon={Megaphone}
          message="No announcements yet"
          sub="Create an announcement to post notices for your customers."
          actionLabel="New Announcement"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="space-y-3">
          {announcements.map((a) => {
            const expired = a.expiresAt && new Date(a.expiresAt) < new Date()
            return (
              <article
                key={a._id}
                className="bg-card border border-border p-4 flex items-start gap-4"
                style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
              >
                <div
                  className="p-2.5 shrink-0"
                  style={{
                    backgroundColor: a.isActive && !expired ? 'var(--gs-admin-accent-muted)' : 'oklch(0.96 0 0)',
                    borderRadius: 'var(--gs-admin-radius-lg)',
                  }}
                >
                  <Megaphone
                    size={16}
                    aria-hidden="true"
                    style={{ color: a.isActive && !expired ? 'var(--gs-admin-accent)' : 'oklch(0.6 0 0)' }}
                  />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-foreground">{a.title}</p>
                    {!a.isActive && (
                      <span
                        className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5"
                        style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                      >
                        Hidden
                      </span>
                    )}
                    {expired && (
                      <span
                        className="text-[10px] font-semibold bg-red-50 text-red-500 px-2 py-0.5"
                        style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                      >
                        Expired
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5 whitespace-pre-wrap">{a.body}</p>
                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                    <span>{format(new Date(a.createdAt), 'MMM d, yyyy')}</span>
                    {a.expiresAt && <span>Expires {format(new Date(a.expiresAt), 'MMM d, yyyy')}</span>}
                    {a.createdBy?.name && <span>by {a.createdBy.name}</span>}
                  </div>
                </div>
                <div className="flex flex-col gap-1 shrink-0">
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={a.isActive ? `Hide announcement ${a.title}` : `Show announcement ${a.title}`}
                    aria-busy={toggleMut.isPending}
                    className="h-7 px-2 text-muted-foreground hover:text-foreground gs-admin-focus-ring"
                    onClick={() => toggleMut.mutate({ id: a._id, isActive: !a.isActive })}
                  >
                    <EyeOff size={13} aria-hidden="true" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    aria-label={`Delete announcement ${a.title}`}
                    aria-busy={deleteMut.isPending}
                    className="h-7 px-2 text-red-500 hover:text-red-600 gs-admin-focus-ring"
                    onClick={() => {
                      if (window.confirm('Delete this announcement?')) deleteMut.mutate(a._id)
                    }}
                  >
                    <Trash2 size={13} aria-hidden="true" />
                  </Button>
                </div>
              </article>
            )
          })}
        </div>
      )}

      {showModal && (
        <AnnouncementModal onClose={() => setShowModal(false)} onSave={(data) => createMut.mutateAsync(data)} />
      )}
    </main>
  )
}
