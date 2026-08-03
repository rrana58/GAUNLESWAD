/**
 * StatCard — Admin Design System: Phase 5.2
 *
 * Shared stat/metric tile used by DashboardPage and AnalyticsPage.
 * Replaces the two duplicate inline StatCard implementations.
 *
 * Usage:
 *   <StatCard
 *     title="Today's Orders"
 *     value={42}
 *     icon={ShoppingBag}
 *     description="Orders placed today"
 *     accentColor="var(--gs-admin-accent)"   // optional icon bg color
 *   />
 *
 * Accessibility:
 *   - Card role="region" with aria-label (WCAG 2.4.1 A)
 *   - Icon aria-hidden (WCAG 1.1.1 A)
 *   - Value is a semantic <strong> so it's emphasised to AT
 *   - Description as supplemental <p> in natural reading order
 */

export default function StatCard({
  title,
  value,
  icon: Icon,
  description,
  accentColor = 'var(--gs-admin-accent)',
  className = '',
}) {
  return (
    <div
      role="region"
      aria-label={`${title}: ${value}`}
      className={`bg-card border border-border p-5 flex items-start gap-4 ${className}`}
      style={{
        borderRadius: 'var(--gs-admin-radius-xl)',
        boxShadow: 'var(--gs-admin-shadow-sm)',
      }}
    >
      {Icon && (
        <div
          aria-hidden="true"
          className="w-10 h-10 flex items-center justify-center shrink-0"
          style={{
            backgroundColor: accentColor,
            borderRadius: 'var(--gs-admin-radius-lg)',
          }}
        >
          <Icon size={18} className="text-white" />
        </div>
      )}
      <div>
        <p className="text-sm text-muted-foreground">{title}</p>
        <strong className="block text-2xl font-bold text-foreground mt-0.5">
          {value}
        </strong>
        {description && (
          <p className="text-xs text-muted-foreground/70 mt-0.5">{description}</p>
        )}
      </div>
    </div>
  )
}
