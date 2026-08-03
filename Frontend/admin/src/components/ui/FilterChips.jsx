/**
 * FilterChips — Admin Design System: Phase 5.1
 *
 * Replaces the repeated status/type filter pill group pattern in:
 *   OrdersPage (order type + status), MenuPage (category filter), ReviewsPage
 *
 * Usage:
 *   <FilterChips
 *     options={[
 *       { value: 'all',   label: 'All' },
 *       { value: 'pending', label: 'Pending' },
 *     ]}
 *     value={statusFilter}
 *     onChange={(v) => { setStatusFilter(v); setPage(1) }}
 *     label="Filter by status"     // aria-label on the group
 *   />
 *
 *   // With custom active color (for status chips that use STATUS_MAP)
 *   <FilterChips
 *     options={statusOptions}
 *     value={statusFilter}
 *     onChange={setStatusFilter}
 *     label="Filter by order status"
 *     getActiveClass={(v) => STATUS_MAP[v]?.bg + ' ' + STATUS_MAP[v]?.text + ' ' + STATUS_MAP[v]?.border}
 *   />
 *
 * Accessibility:
 *   - role="group" aria-label on container (WCAG 1.3.1 A)
 *   - aria-pressed on each chip button (WCAG 4.1.2 A)
 *   - gs-admin-focus-ring on each chip (WCAG 2.4.7 AA)
 */

export default function FilterChips({
  options,
  value,
  onChange,
  label,
  getActiveClass,
  size = 'sm',
}) {
  const sizeClass = size === 'xs'
    ? 'px-2.5 py-1 text-[11px]'
    : 'px-3 py-1.5 text-xs'

  return (
    <div
      role="group"
      aria-label={label}
      className="flex flex-wrap gap-2 items-center"
    >
      {options.map((opt) => {
        const isActive = value === opt.value
        const activeClass = isActive
          ? (getActiveClass?.(opt.value) ?? 'bg-foreground text-background border-foreground')
          : 'bg-card text-muted-foreground border-border hover:border-foreground/30'

        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={isActive}
            className={`${sizeClass} font-medium border transition-colors capitalize gs-admin-focus-ring ${activeClass}`}
            style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
          >
            {opt.label ?? opt.value}
          </button>
        )
      })}
    </div>
  )
}
