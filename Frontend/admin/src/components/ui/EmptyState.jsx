/**
 * EmptyState — Admin Design System: Phase 5.1
 *
 * Replaces all inline "No X found" / empty list patterns.
 *
 * Usage:
 *   <EmptyState message="No orders found" />
 *   <EmptyState icon={ShoppingBag} message="No orders found" sub="Try changing your filters" />
 *   <EmptyState message="No orders found" action={<Button>Create</Button>} />
 *
 * Accessibility:
 *   - role="status" so screen readers announce empty state (WCAG 4.1.3 AA)
 *   - Icon aria-hidden (WCAG 1.1.1 A)
 *   - aria-label carries full message + sub
 */

export default function EmptyState({
  icon: Icon,
  message,
  sub,
  action,
  className = '',
  height = 'h-64',
}) {
  const label = sub ? `${message}. ${sub}` : message

  return (
    <div
      role="status"
      aria-label={label}
      className={`flex flex-col items-center justify-center gap-3 ${height} text-muted-foreground ${className}`}
    >
      {Icon && (
        <Icon
          aria-hidden="true"
          size={32}
          className="text-muted-foreground/40"
        />
      )}
      <p className="text-sm font-medium" aria-hidden="true">{message}</p>
      {sub && (
        <p className="text-xs text-muted-foreground/60" aria-hidden="true">{sub}</p>
      )}
      {action && <div className="mt-1">{action}</div>}
    </div>
  )
}
