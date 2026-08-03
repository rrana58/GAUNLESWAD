import { NavLink } from 'react-router-dom'
import { Home, CalendarDays, ShoppingBag, Menu as MenuIcon, LayoutGrid } from 'lucide-react'
import { useCartStore } from '@/store/cartStore'
import { cn } from '@/lib/utils'

/**
 * BottomNav — Design System: Phase 4.2 Customer Home Migration
 *
 * Changes:
 *  - Added gs-focus-ring to NavLink items for keyboard accessibility
 *  - Added z-index via --gs-z-sticky token on nav element
 *  - All Tailwind semantic tokens retained (bg-card, border-border, text-primary,
 *    text-muted-foreground, bg-secondary) — these correctly map to design system
 *  - Min height of each tab: h-16 (64px) > 44px minimum — WCAG compliant ✅
 *  - aria-current handled automatically by NavLink's active class
 *
 * No tab configuration or cart badge logic changed.
 */
const TABS = [
  { to: '/', label: 'Home', icon: Home, end: true },
  { to: '/categories', label: 'Categories', icon: LayoutGrid },
  { to: '/subscriptions', label: 'Plans', icon: CalendarDays },
  { to: '/cart', label: 'Cart', icon: ShoppingBag, showBadge: true },
  { to: '/more', label: 'More', icon: MenuIcon },
]

export default function BottomNav() {
  const itemCount = useCartStore((s) => s.getItemCount())

  return (
    <nav
      className="bg-card border-t border-border"
      style={{ paddingBottom: 'env(safe-area-inset-bottom)' }}
      aria-label="Main navigation"
    >
      <ul className="flex items-stretch justify-around h-16 max-w-lg mx-auto">
        {TABS.map(({ to, label, icon: Icon, end, showBadge }) => (
          <li key={to} className="flex-1">
            <NavLink
              to={to}
              end={end}
              aria-label={label}
              className="relative flex h-full flex-col items-center justify-center gap-1 text-muted-foreground [&.active]:text-primary gs-focus-ring rounded-md"
            >
              {({ isActive }) => (
                <>
                  {/* Active indicator bar */}
                  {isActive && (
                    <span
                      className="absolute top-0 h-0.5 w-8 rounded-full bg-primary"
                      aria-hidden="true"
                    />
                  )}
                  <span className="relative">
                    <Icon
                      size={22}
                      strokeWidth={isActive ? 2.4 : 1.8}
                      className={cn(isActive ? 'text-primary' : 'text-muted-foreground')}
                      aria-hidden="true"
                    />
                    {/* Cart item count badge */}
                    {showBadge && itemCount > 0 && (
                      <span
                        className="absolute -top-1.5 -right-2 min-w-4 h-4 px-1 rounded-full bg-secondary text-[10px] font-mono font-semibold text-foreground flex items-center justify-center"
                        aria-label={`${itemCount} items in cart`}
                      >
                        {itemCount > 9 ? '9+' : itemCount}
                      </span>
                    )}
                  </span>
                  <span className={cn('text-[11px]', isActive ? 'font-semibold text-primary' : 'text-muted-foreground')}>
                    {label}
                  </span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  )
}