import { useState } from 'react'
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { getProblemReports, updateProblemReportStatus } from '@/api/admin'
import { toast } from 'sonner'
import { AlertTriangle, Phone, Mail } from 'lucide-react'
import { format } from 'date-fns'
import { Label } from '@/components/ui/label'
import Spinner from '@/components/ui/Spinner'
import StatusBadge from '@/components/ui/StatusBadge'
import EmptyState from '@/components/ui/EmptyState'
import FilterChips from '@/components/ui/FilterChips'

const STATUS_OPTIONS = [
  { value: '', label: 'All statuses' },
  { value: 'open', label: 'Open' },
  { value: 'in_progress', label: 'In progress' },
  { value: 'resolved', label: 'Resolved' },
]

const PROBLEM_TYPE_LABELS = {
  order: 'Order issue',
  payment: 'Payment issue',
  delivery: 'Delivery issue',
  food_menu: 'Food / Menu issue',
  technical: 'App / Technical issue',
  other: 'Other',
}

export default function ProblemReportsPage() {
  const [statusFilter, setStatusFilter] = useState('')
  const queryClient = useQueryClient()

  const { data, isLoading } = useQuery({
    queryKey: ['problemReports', statusFilter],
    queryFn: () =>
      getProblemReports({
        status: statusFilter || undefined,
        page: 1,
        limit: 50,
      }).then((r) => r.data),
  })

  const reports = data?.reports || []

  const statusMut = useMutation({
    mutationFn: ({ id, status }) => updateProblemReportStatus(id, status),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['problemReports'] })
      toast.success('Problem report status updated')
    },
    onError: (err) => {
      toast.error(err.response?.data?.message || 'Failed to update status')
    },
  })

  return (
    <main className="space-y-5" aria-label="Problem reports management">
      <header className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Problem Reports</h1>
          <p className="text-muted-foreground text-sm mt-1">
            Customer-reported problems and support issues
          </p>
        </div>

        <FilterChips
          label="Filter problem reports by status"
          options={STATUS_OPTIONS}
          value={statusFilter}
          onChange={setStatusFilter}
        />
      </header>

      {isLoading ? (
        <div className="flex items-center justify-center h-48">
          <Spinner size="lg" label="Loading problem reports..." />
        </div>
      ) : reports.length === 0 ? (
        <EmptyState
          icon={AlertTriangle}
          message="No problem reports"
          sub="Customer reports will appear here."
        />
      ) : (
        <div className="space-y-3">
          {reports.map((report) => (
            <article
              key={report._id}
              className="bg-card border border-border p-4"
              style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
            >
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="font-medium text-foreground">
                      {report.customer?.name || 'Customer'}
                    </p>
                    <StatusBadge status={report.status} size="sm" />
                  </div>

                  <p
                    className="text-sm font-medium mt-1"
                    style={{ color: 'var(--gs-admin-accent)' }}
                  >
                    {PROBLEM_TYPE_LABELS[report.problemType] || report.problemType}
                  </p>

                  <div className="flex items-center gap-3 mt-2 text-xs text-muted-foreground/70 flex-wrap">
                    {report.customer?.phone && (
                      <span className="flex items-center gap-1">
                        <Phone size={11} aria-hidden="true" />
                        +977 {report.customer.phone}
                      </span>
                    )}

                    {report.customer?.email && (
                      <span className="flex items-center gap-1">
                        <Mail size={11} aria-hidden="true" />
                        {report.customer.email}
                      </span>
                    )}

                    <span>
                      {format(new Date(report.createdAt), 'MMM d, yyyy, h:mm a')}
                    </span>
                  </div>

                  {report.order?.orderNumber && (
                    <p className="text-xs text-muted-foreground mt-2">
                      Order: <span className="font-medium text-foreground">{report.order.orderNumber}</span>
                    </p>
                  )}

                  <p className="text-sm text-foreground mt-3 whitespace-pre-wrap">
                    {report.description}
                  </p>
                </div>

                <div className="shrink-0 space-y-1">
                  <Label
                    htmlFor={`report-status-${report._id}`}
                    className="sr-only"
                  >
                    Update problem report status
                  </Label>

                  <select
                    id={`report-status-${report._id}`}
                    aria-label={`Update status for problem report from ${report.customer?.name || 'customer'}`}
                    value={report.status}
                    onChange={(e) =>
                      statusMut.mutate({
                        id: report._id,
                        status: e.target.value,
                      })
                    }
                    disabled={statusMut.isPending}
                    className="h-8 border border-border bg-card text-foreground px-2 text-xs outline-none gs-admin-focus-ring shrink-0"
                    style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
                  >
                    <option value="open">Open</option>
                    <option value="in_progress">In progress</option>
                    <option value="resolved">Resolved</option>
                  </select>
                </div>
              </div>
            </article>
          ))}
        </div>
      )}
    </main>
  )
}