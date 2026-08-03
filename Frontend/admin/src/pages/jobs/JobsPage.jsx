import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobs, createJob, updateJob, deleteJob } from '@/api/admin'
import { toast } from 'sonner'
import { Plus, Trash2, Briefcase, EyeOff, Users } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { format } from 'date-fns'
import Modal from '@/components/ui/Modal'
import Spinner from '@/components/ui/Spinner'
import EmptyState from '@/components/ui/EmptyState'

/**
 * JobsPage — Design System: Phase 5.6
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500 / text-gray-400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Empty state -> <EmptyState />
 *  - Custom JobModal overlay -> <Modal size="sm">
 *  - Brand orange -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-lg / rounded-full -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Job openings management">
 *  - Header landmark
 *  - Form controls with id and htmlFor
 *  - Decorative icons with aria-hidden="true"
 *  - Buttons with descriptive aria-label, focus ring, and aria-busy
 */

const EMPLOYMENT_TYPES = [
  { value: 'full-time', label: 'Full-time' },
  { value: 'part-time', label: 'Part-time' },
  { value: 'internship', label: 'Internship' },
  { value: 'contract', label: 'Contract' },
]

function JobModal({ onClose, onSave }) {
  const [form, setForm] = useState({
    title: '', description: '', location: 'Waling, Gandaki', employmentType: 'full-time',
  })
  const [loading, setLoading] = useState(false)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  const handleSubmit = async (e) => {
    e.preventDefault()
    if (!form.title.trim()) return toast.error('Title is required')
    if (!form.description.trim()) return toast.error('Description is required')
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
      title="Post Job Opening"
      size="sm"
    >
      <form
        onSubmit={handleSubmit}
        className="p-5 space-y-4"
        aria-label="Post job opening form"
      >
        <div className="space-y-1.5">
          <Label htmlFor="job-title">Job Title *</Label>
          <Input
            id="job-title"
            required
            aria-required="true"
            value={form.title}
            onChange={(e) => set('title', e.target.value)}
            placeholder="e.g. Delivery Rider"
            maxLength={100}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="job-desc">Description *</Label>
          <textarea
            id="job-desc"
            required
            aria-required="true"
            value={form.description}
            onChange={(e) => set('description', e.target.value)}
            placeholder="Responsibilities, requirements, pay, timings..."
            maxLength={2000}
            rows={5}
            className="w-full border border-border bg-card text-foreground px-3 py-2 text-sm resize-none focus:outline-none gs-admin-focus-ring"
            style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
          />
        </div>
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <Label htmlFor="job-location">Location</Label>
            <Input
              id="job-location"
              value={form.location}
              onChange={(e) => set('location', e.target.value)}
              maxLength={100}
            />
          </div>
          <div className="space-y-1.5">
            <Label htmlFor="job-type">Type</Label>
            <select
              id="job-type"
              value={form.employmentType}
              onChange={(e) => set('employmentType', e.target.value)}
              className="w-full h-9 border border-border bg-card text-foreground px-3 text-sm outline-none gs-admin-focus-ring"
              style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
            >
              {EMPLOYMENT_TYPES.map((t) => (
                <option key={t.value} value={t.value}>{t.label}</option>
              ))}
            </select>
          </div>
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
            {loading && <Spinner size="sm" label="Posting job..." className="mr-2" />}
            Post Job
          </Button>
        </div>
      </form>
    </Modal>
  )
}

export default function JobsPage() {
  const queryClient = useQueryClient()
  const [showModal, setShowModal] = useState(false)

  const { data, isLoading } = useQuery({
    queryKey: ['jobs'],
    queryFn: () => getJobs().then((r) => r.data.jobs || []),
  })

  const jobs = data || []
  const invalidate = () => queryClient.invalidateQueries(['jobs'])

  const createMut = useMutation({
    mutationFn: (data) => createJob(data),
    onSuccess: () => { invalidate(); toast.success('Job posted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const toggleMut = useMutation({
    mutationFn: ({ id, isActive }) => updateJob(id, { isActive }),
    onSuccess: () => { invalidate(); toast.success('Updated') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  const deleteMut = useMutation({
    mutationFn: (id) => deleteJob(id),
    onSuccess: () => { invalidate(); toast.success('Deleted') },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  return (
    <main className="space-y-5" aria-label="Job openings management">
      <header className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Openings</h1>
          <p className="text-muted-foreground text-sm mt-1">Careers listed in the customer app's More tab</p>
        </div>
        <div className="flex gap-2">
          <Link to="/jobs/applications">
            <Button variant="outline" className="gs-admin-focus-ring">
              <Users size={16} className="mr-2" aria-hidden="true" /> Applications
            </Button>
          </Link>
          <Button
            aria-label="Post new job"
            className="gs-admin-focus-ring"
            style={{ backgroundColor: 'var(--gs-admin-accent)', color: 'var(--gs-admin-accent-foreground)' }}
            onClick={() => setShowModal(true)}
          >
            <Plus size={16} className="mr-2" aria-hidden="true" /> New Job
          </Button>
        </div>
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading job openings..." />
        </div>
      ) : jobs.length === 0 ? (
        <EmptyState
          icon={Briefcase}
          message="No job openings posted yet"
          sub="Post open positions to recruit candidates for your kitchen."
          actionLabel="New Job"
          onAction={() => setShowModal(true)}
        />
      ) : (
        <div className="space-y-3">
          {jobs.map((j) => (
            <article
              key={j._id}
              className="bg-card border border-border p-4 flex items-start gap-4"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div
                className="p-2.5 shrink-0"
                style={{
                  backgroundColor: j.isActive ? 'var(--gs-admin-accent-muted)' : 'oklch(0.96 0 0)',
                  borderRadius: 'var(--gs-admin-radius-lg)',
                }}
              >
                <Briefcase
                  size={16}
                  aria-hidden="true"
                  style={{ color: j.isActive ? 'var(--gs-admin-accent)' : 'oklch(0.6 0 0)' }}
                />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground">{j.title}</p>
                  <span
                    className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5 capitalize"
                    style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                  >
                    {j.employmentType?.replace('-', ' ')}
                  </span>
                  {!j.isActive && (
                    <span
                      className="text-[10px] font-semibold bg-muted text-muted-foreground px-2 py-0.5"
                      style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                    >
                      Closed
                    </span>
                  )}
                </div>
                <p className="text-sm text-muted-foreground mt-1 line-clamp-2">{j.description}</p>
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                  <span>{j.location}</span>
                  <span>{format(new Date(j.createdAt), 'MMM d, yyyy')}</span>
                  <Link
                    to={`/jobs/applications?jobId=${j._id}`}
                    className="font-medium hover:underline gs-admin-focus-ring"
                    style={{ color: 'var(--gs-admin-accent)' }}
                  >
                    {j.applicationCount} application{j.applicationCount === 1 ? '' : 's'}
                  </Link>
                </div>
              </div>
              <div className="flex flex-col gap-1 shrink-0">
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={j.isActive ? `Close job posting ${j.title}` : `Reopen job posting ${j.title}`}
                  aria-busy={toggleMut.isPending}
                  className="h-7 px-2 text-muted-foreground hover:text-foreground gs-admin-focus-ring"
                  onClick={() => toggleMut.mutate({ id: j._id, isActive: !j.isActive })}
                >
                  <EyeOff size={13} aria-hidden="true" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Delete job posting ${j.title}`}
                  aria-busy={deleteMut.isPending}
                  className="h-7 px-2 text-red-500 hover:text-red-600 gs-admin-focus-ring"
                  onClick={() => {
                    if (window.confirm('Delete this job posting?')) deleteMut.mutate(j._id)
                  }}
                >
                  <Trash2 size={13} aria-hidden="true" />
                </Button>
              </div>
            </article>
          ))}
        </div>
      )}

      {showModal && (
        <JobModal onClose={() => setShowModal(false)} onSave={(data) => createMut.mutateAsync(data)} />
      )}
    </main>
  )
}
