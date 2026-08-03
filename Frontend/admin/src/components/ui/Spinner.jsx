/**
 * Spinner — Admin Design System: Phase 5.1
 *
 * Replaces every inline `<Loader2 className="animate-spin text-orange-500">`
 * pattern across the admin app. Single source of truth for loading spinners.
 *
 * Usage:
 *   <Spinner />                  — default (md, accent color)
 *   <Spinner size="sm" />        — small (16px)
 *   <Spinner size="lg" />        — large (40px)
 *   <Spinner label="Loading orders..." />  — custom sr-only label
 *   <Spinner color="muted" />    — muted-foreground color
 *
 * Accessibility:
 *   - role="status" + aria-label on wrapper (WCAG 4.1.3 AA)
 *   - Spinner icon aria-hidden (WCAG 1.1.1 A)
 *   - sr-only visible text for screen readers
 */

const SIZE = {
  sm: 16,
  md: 24,
  lg: 40,
}

export default function Spinner({
  size = 'md',
  label = 'Loading…',
  color = 'accent',
  className = '',
}) {
  const px = SIZE[size] ?? SIZE.md
  const colorClass =
    color === 'muted'
      ? 'text-muted-foreground/50'
      : 'text-[var(--gs-admin-accent)]'

  return (
    <div
      role="status"
      aria-label={label}
      className={`flex items-center justify-center ${className}`}
    >
      <svg
        aria-hidden="true"
        xmlns="http://www.w3.org/2000/svg"
        width={px}
        height={px}
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
        className={`animate-spin ${colorClass}`}
      >
        <path d="M21 12a9 9 0 1 1-6.219-8.56" />
      </svg>
      <span className="sr-only">{label}</span>
    </div>
  )
}
