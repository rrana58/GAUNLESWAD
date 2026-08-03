/**
 * StatusBadge — Admin Design System: Phase 5.1
 *
 * Replaces every inline `<span className="px-2 py-0.5 rounded-full ... capitalize">` 
 * status pattern across the admin app.
 *
 * Usage:
 *   <StatusBadge status="pending" />
 *   <StatusBadge status="delivered" size="sm" />
 *   <StatusBadge status="cancelled" size="lg" />
 *
 * Accessibility:
 *   - aria-label carries human-readable status (WCAG 1.3.1 A)
 *   - Does NOT convey status by color alone (text label always present)
 */

const STATUS_MAP = {
  // Order flow
  pending:          { bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-200',  label: 'Pending' },
  confirmed:        { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    label: 'Confirmed' },
  preparing:        { bg: 'bg-orange-100',  text: 'text-[var(--gs-admin-accent-muted-fg)]', border: 'border-orange-200', label: 'Preparing' },
  ready:            { bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-200',  label: 'Ready' },
  out_for_delivery: { bg: 'bg-indigo-100',  text: 'text-indigo-700',  border: 'border-indigo-200',  label: 'Out for Delivery' },
  delivered:        { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-200',   label: 'Delivered' },
  cancelled:        { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200',     label: 'Cancelled' },
  refunded:         { bg: 'bg-gray-100',    text: 'text-muted-foreground', border: 'border-border', label: 'Refunded' },

  // Payment
  paid:             { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-200',   label: 'Paid' },
  unpaid:           { bg: 'bg-yellow-100',  text: 'text-yellow-700',  border: 'border-yellow-200',  label: 'Unpaid' },
  failed:           { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200',     label: 'Failed' },

  // User roles
  admin:            { bg: 'bg-purple-100',  text: 'text-purple-700',  border: 'border-purple-200',  label: 'Admin' },
  kitchen:          { bg: 'bg-blue-100',    text: 'text-blue-700',    border: 'border-blue-200',    label: 'Kitchen' },
  delivery:         { bg: 'bg-orange-100',  text: 'text-[var(--gs-admin-accent-muted-fg)]', border: 'border-orange-200', label: 'Delivery' },
  customer:         { bg: 'bg-gray-100',    text: 'text-muted-foreground', border: 'border-border', label: 'Customer' },

  // Generic
  active:           { bg: 'bg-green-100',   text: 'text-green-700',   border: 'border-green-200',   label: 'Active' },
  inactive:         { bg: 'bg-gray-100',    text: 'text-muted-foreground', border: 'border-border', label: 'Inactive' },
  expired:          { bg: 'bg-red-100',     text: 'text-red-700',     border: 'border-red-200',     label: 'Expired' },
}

const FALLBACK = { bg: 'bg-muted', text: 'text-muted-foreground', border: 'border-border', label: null }

const SIZE_CLASS = {
  sm: 'px-1.5 py-0.5 text-[10px]',
  md: 'px-2 py-0.5 text-xs',
  lg: 'px-3 py-1 text-sm',
}

export default function StatusBadge({ status, size = 'md', className = '' }) {
  const token = STATUS_MAP[status] ?? FALLBACK
  const label = token.label ?? status?.replace(/_/g, ' ') ?? '—'

  return (
    <span
      aria-label={`Status: ${label}`}
      className={`inline-flex items-center font-medium capitalize border ${token.bg} ${token.text} ${token.border} ${SIZE_CLASS[size] ?? SIZE_CLASS.md} ${className}`}
      style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
    >
      {label}
    </span>
  )
}

/**
 * Export the raw STATUS_MAP so pages can look up bg/text classes
 * when they need to style other elements (e.g. table row highlights).
 */
export { STATUS_MAP }
