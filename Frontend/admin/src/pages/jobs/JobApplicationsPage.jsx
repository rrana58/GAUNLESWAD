import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getJobApplications, updateJobApplicationStatus } from '@/api/admin'
import { toast } from 'sonner'
import { Users, Phone } from 'lucide-react'
import { format } from 'date-fns'
import { Label } from '@/components/ui/label'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import FilterChips from '@/components/ui/FilterChips'

/**
 * JobApplicationsPage — Design System: Phase 5.6
 *
 * Token & Component changes:
 *  - bg-white -> bg-card
 *  - bg-gray-50 -> bg-muted
 *  - border-gray-100 / border-gray-200 -> border-border
 *  - text-gray-900 -> text-foreground
 *  - text-gray-500 / text-gray-400 -> text-muted-foreground / text-muted-foreground/60
 *  - Loader2 -> <Spinner />
 *  - Status styles -> <StatusBadge />
 *  - Empty state -> <EmptyState />
 *  - Filter select -> <FilterChips />
 *  - Brand orange -> var(--gs-admin-accent)
 *  - rounded-xl / rounded-lg / rounded-full -> radius tokens via style
 *
 * Accessibility:
 *  - <main aria-label="Job applications management">
 *  - Header landmark
 *  - Form controls with id and htmlFor
 *  - Decorative icons with aria-hidden="true"
 *  - Status update selects with aria-label per application
 */

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'new', label: 'New' },
  { value: 'reviewed', label: 'Reviewed' },
  { value: 'contacted', label: 'Contacted' },
  { value: 'rejected', label: 'Rejected' },
]

export default function JobApplicationsPage() {
  const [searchParams] = useSearchParams()
  const jobId = searchParams.get('jobId') || ''
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['jobApplications', jobId, statusFilter],
    queryFn: () =>
      getJobApplications({ jobId: jobId || undefined, status: statusFilter || undefined, limit: 50 })
        .then((r) => r.data),
  })

  const applications = data?.applications || []

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateJobApplicationStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries(['jobApplications'])
      toast.success('Status updated')
    },
    onError: (err) => toast.error(err.response?.data?.message || 'Failed'),
  })

  return (
    <main className="space-y-5" aria-label="Job applications management">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Job Applications</h1>
          <p className="text-muted-foreground text-sm mt-1">
            {jobId ? 'Filtered to one job posting' : 'All applications across every job posting'}
          </p>
        </div>
        <FilterChips
          label="Filter applications by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading job applications..." />
        </div>
      ) : applications.length === 0 ? (
        <EmptyState
          icon={Users}
          message="No applications yet"
          sub="Submissions from candidates will appear here."
        />
      ) : (
        <div className="space-y-3">
          {applications.map((app) => (
            <article
              key={app._id}
              className="bg-card border border-border p-4 flex items-start gap-4"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-foreground">{app.name}</p>
                  <StatusBadge status={app.status} size="sm" />
                </div>
                <p
                  className="text-sm font-medium mt-0.5"
                  style={{ color: 'var(--gs-admin-accent)' }}
                >
                  {app.jobTitle || app.job?.title}
                </p>
                {app.message && <p className="text-sm text-muted-foreground mt-1.5">{app.message}</p>}
                <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/60">
                  <span className="flex items-center gap-1">
                    <Phone size={11} aria-hidden="true" /> +977 {app.phone}
                  </span>
                  <span>{format(new Date(app.createdAt), 'MMM d, yyyy, h:mm a')}</span>
                </div>
              </div>
              <div className="shrink-0 space-y-1">
                <Label htmlFor={`app-status-${app._id}`} className="sr-only">Update application status</Label>
                <select
                  id={`app-status-${app._id}`}
                  aria-label={`Update status for applicant ${app.name}`}
                  value={app.status}
                  onChange={(e) => statusMut.mutate({ id: app._id, status: e.target.value })}
                  disabled={statusMut.isPending}
                  className="h-8 border border-border bg-card text-foreground px-2 text-xs outline-none gs-admin-focus-ring shrink-0"
                  style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                >
                  {['new', 'reviewed', 'contacted', 'rejected'].map((s) => (
                    <option key={s} value={s} className="capitalize">{s}</option>
                  ))}
                </select>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}
