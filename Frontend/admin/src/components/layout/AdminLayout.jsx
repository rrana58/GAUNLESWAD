import { useState } from 'react'
import { Outlet, NavLink, useNavigate } from 'react-router-dom'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { useOrderNotifications } from '@/hooks/useOrderNotifications'
import {
  LayoutDashboard, ShoppingBag, UtensilsCrossed, Ticket,
  CalendarX, Settings, Users, BarChart3, Clock, CreditCard,
  LogOut, Menu, Star, Bell, BellOff, Megaphone, Briefcase, Gift
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { toast } from 'sonner'

/**
 * AdminLayout — Design System: Phase 5.1
 *
 * Token changes:
 *  - Root wrapper:       bg-gray-50  → bg-muted/50
 *  - Sidebar:            bg-white border-gray-200 → bg-card border-border
 *  - Logo section:       border-gray-200 → border-border
 *  - Logo badge:         bg-orange-500 → var(--gs-admin-accent)
 *  - Brand text:         text-gray-900 → text-foreground
 *  - Brand sub:          text-gray-500 → text-muted-foreground
 *  - NavLink active:     bg-orange-50 text-orange-600 → accent muted bg + accent text
 *  - NavLink inactive:   text-gray-600 hover:bg-gray-50 hover:text-gray-900 → semantic
 *  - Order badge:        bg-orange-500 text-white → accent bg + accent-foreground
 *  - Footer border:      border-gray-200 → border-border
 *  - User card:          bg-gray-50 → bg-muted
 *  - Avatar:             bg-orange-100 → admin accent muted bg
 *  - Avatar text:        text-orange-600 → admin accent muted fg
 *  - User name:          text-gray-900 → text-foreground
 *  - User phone:         text-gray-500 → text-muted-foreground
 *  - Logout button:      hover:bg-red-50 hover:text-red-500 → hover:bg-destructive/10 hover:text-destructive
 *  - Topbar:             bg-white border-gray-200 → bg-card border-border
 *  - Topbar text:        text-gray-400/700 → text-muted-foreground / text-foreground
 *  - Topbar icon buttons: text-gray-500 hover:bg-gray-50 → text-muted-foreground hover:bg-muted
 *  - Main content:       bg-gray-50/50 → bg-muted/30
 *
 * Accessibility:
 *  - <aside> aria-label="Sidebar navigation"
 *  - <nav> aria-label="Main navigation"
 *  - NavLink aria-label={label} (visible when sidebar is collapsed)
 *  - NavLink aria-current="page" when active (in addition to class)
 *  - Collapsed nav icon wrapper: title={label} for tooltip
 *  - Nav icons: aria-hidden="true"
 *  - Order badge: aria-label="{n} unread orders" aria-hidden on the visual badge
 *  - Sidebar toggle: aria-label + aria-expanded
 *  - Sidebar toggle icon: aria-hidden
 *  - Bell/BellOff: aria-hidden (aria-label already on the Button)
 *  - Logo mark: aria-hidden (it's decorative; brand name nearby provides context)
 *  - User card: aria-label on the container
 *  - Logout buttons: aria-label, LogOut icon aria-hidden
 *  - Topbar <header>: aria-label="Admin toolbar"
 *  - Date display: aria-label
 *
 * No API, auth, socket, or navigation logic changed.
 */

const navItems = [
  { to: '/', icon: LayoutDashboard, label: 'Dashboard' },
  { to: '/orders', icon: ShoppingBag, label: 'Orders' },
  { to: '/menu', icon: UtensilsCrossed, label: 'Menu' },
  { to: '/sessions', icon: Clock, label: 'Special Sessions' },
  { to: '/coupons', icon: Ticket, label: 'Coupons' },
  { to: '/subscriptions', icon: CreditCard, label: 'Subscriptions' },
  { to: '/celebrations', icon: Gift, label: 'Celebrations' },
  { to: '/closed-dates', icon: CalendarX, label: 'Closed Dates' },
  { to: '/reviews', icon: Star, label: 'Reviews' },
  { to: '/announcements', icon: Megaphone, label: 'Announcements' },
  { to: '/jobs', icon: Briefcase, label: 'Jobs' },
  { to: '/analytics', icon: BarChart3, label: 'Analytics' },
  { to: '/users', icon: Users, label: 'Users' },
  { to: '/settings', icon: Settings, label: 'Settings' },
]

export default function AdminLayout() {
  const { user, logout } = useAuthStore()
  const navigate = useNavigate()
  const [sidebarOpen, setSidebarOpen] = useState(true)
  const unreadOrders = useNotificationStore((s) => s.unreadOrders)
  const soundEnabled = useNotificationStore((s) => s.soundEnabled)
  const toggleSound = useNotificationStore((s) => s.toggleSound)

  // Connects the admin socket and turns incoming orders into toasts + sound + badge
  useOrderNotifications()

  const handleLogout = () => {
    logout()
    toast.success('Logged out successfully')
    navigate('/login')
  }

  const todayLabel = new Date().toLocaleDateString('en-NP', {
    weekday: 'short', year: 'numeric', month: 'short', day: 'numeric',
  })

  return (
    <div
      className="flex h-screen overflow-hidden print:h-auto print:overflow-visible print:block"
      style={{ backgroundColor: 'oklch(0.98 0 0)' }}
    >
      {/* ── Sidebar ────────────────────────────────────────────────────── */}
      <aside
        aria-label="Sidebar navigation"
        className={`${sidebarOpen ? 'w-64' : 'w-16'} bg-card border-r border-border flex flex-col transition-all duration-300 shrink-0 h-screen print:hidden`}
      >
        {/* Logo */}
        <div className="h-16 flex items-center px-4 border-b border-border gap-3 overflow-hidden">
          <div
            aria-hidden="true"
            className="w-8 h-8 flex items-center justify-center shrink-0"
            style={{
              backgroundColor: 'var(--gs-admin-accent)',
              borderRadius: 'var(--gs-admin-radius-lg)',
            }}
          >
            <span className="text-white font-bold text-sm select-none">घ</span>
          </div>
          {sidebarOpen && (
            <div className="min-w-0 transition-opacity duration-300">
              <p className="font-semibold text-foreground text-sm leading-tight truncate">
                Gharko Swad
              </p>
              <p className="text-xs text-muted-foreground truncate">Admin Panel</p>
            </div>
          )}
        </div>

        {/* Nav */}
        <nav className="flex-1 py-4 overflow-y-auto no-scrollbar" aria-label="Main navigation">
          <ul role="list">
            {navItems.map(({ to, icon: Icon, label }) => (
              <li key={to} role="listitem">
                <NavLink
                  to={to}
                  end={to === '/'}
                  aria-label={label}
                  className={({ isActive }) =>
                    `flex items-center gap-3 px-4 py-2.5 mx-2 text-sm font-medium transition-colors gs-admin-focus-ring ${
                      isActive
                        ? 'text-[var(--gs-admin-accent)]'
                        : 'text-muted-foreground hover:text-foreground hover:bg-muted'
                    }`
                  }
                  style={({ isActive }) =>
                    isActive
                      ? {
                          backgroundColor: 'var(--gs-admin-accent-muted)',
                          borderRadius: 'var(--gs-admin-radius-lg)',
                        }
                      : { borderRadius: 'var(--gs-admin-radius-lg)' }
                  }
                >
                  {({ isActive }) => (
                    <>
                      <span className="relative shrink-0">
                        <Icon size={18} aria-hidden="true" />
                        {to === '/orders' && unreadOrders > 0 && (
                          <span
                            aria-hidden="true"
                            className="absolute -top-1.5 -right-1.5 min-w-[16px] h-4 px-1 text-[10px] font-semibold flex items-center justify-center"
                            style={{
                              backgroundColor: 'var(--gs-admin-accent)',
                              color: 'var(--gs-admin-accent-foreground)',
                              borderRadius: 'var(--gs-admin-radius-full)',
                            }}
                          >
                            {unreadOrders > 9 ? '9+' : unreadOrders}
                          </span>
                        )}
                      </span>
                      {sidebarOpen && (
                        <span className="truncate flex-1">{label}</span>
                      )}
                      {sidebarOpen && to === '/orders' && unreadOrders > 0 && (
                        <span
                          aria-label={`${unreadOrders > 9 ? '9+' : unreadOrders} unread orders`}
                          className="text-[10px] font-semibold px-1.5 py-0.5"
                          style={{
                            backgroundColor: 'var(--gs-admin-accent)',
                            color: 'var(--gs-admin-accent-foreground)',
                            borderRadius: 'var(--gs-admin-radius-full)',
                          }}
                        >
                          {unreadOrders > 9 ? '9+' : unreadOrders}
                        </span>
                      )}
                    </>
                  )}
                </NavLink>
              </li>
            ))}
          </ul>
        </nav>

        {/* User + Logout */}
        <div className="border-t border-border p-3">
          {sidebarOpen ? (
            <div
              className="flex items-center gap-3 p-2"
              style={{
                backgroundColor: 'var(--gs-admin-accent-muted)',
                borderRadius: 'var(--gs-admin-radius-xl)',
              }}
              aria-label={`Signed in as ${user?.name || 'Admin'}`}
            >
              <div
                aria-hidden="true"
                className="w-8 h-8 flex items-center justify-center shrink-0"
                style={{
                  backgroundColor: 'var(--gs-admin-accent-dim)',
                  borderRadius: 'var(--gs-admin-radius-full)',
                }}
              >
                <span
                  className="font-semibold text-sm"
                  style={{ color: 'var(--gs-admin-accent)' }}
                >
                  {user?.name?.[0] || 'A'}
                </span>
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-foreground truncate">
                  {user?.name || 'Admin'}
                </p>
                <p className="text-xs text-muted-foreground truncate">{user?.phone}</p>
              </div>
              <button
                onClick={handleLogout}
                aria-label="Log out"
                className="p-1.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors gs-admin-focus-ring"
                style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
              >
                <LogOut size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <button
              onClick={handleLogout}
              aria-label="Log out"
              className="w-full flex justify-center p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors gs-admin-focus-ring"
              style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
            >
              <LogOut size={18} aria-hidden="true" />
            </button>
          )}
        </div>
      </aside>

      {/* ── Main container ──────────────────────────────────────────────── */}
      <div className="flex-1 flex flex-col overflow-hidden print:overflow-visible print:block">

        {/* Topbar */}
        <header
          aria-label="Admin toolbar"
          className="h-16 bg-card border-b border-border flex items-center px-4 gap-4 shrink-0 print:hidden"
        >
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setSidebarOpen(!sidebarOpen)}
            aria-label={sidebarOpen ? 'Collapse sidebar' : 'Expand sidebar'}
            aria-expanded={sidebarOpen}
            className="text-muted-foreground hover:bg-muted gs-admin-focus-ring"
          >
            <Menu size={20} aria-hidden="true" />
          </Button>

          <div className="flex-1" />

          <Button
            variant="ghost"
            size="icon"
            onClick={toggleSound}
            aria-label={soundEnabled ? 'Mute new order sound' : 'Unmute new order sound'}
            title={soundEnabled ? 'New order sound: on' : 'New order sound: muted'}
            className="text-muted-foreground hover:bg-muted gs-admin-focus-ring"
          >
            {soundEnabled
              ? <Bell size={18} aria-hidden="true" />
              : <BellOff size={18} aria-hidden="true" />
            }
          </Button>

          <div
            className="hidden md:block text-right"
            aria-label={`Nepal Standard Time — ${todayLabel}`}
          >
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider block">
              Nepal Standard Time
            </span>
            <span className="text-sm font-semibold text-foreground">
              {todayLabel}
            </span>
          </div>
        </header>

        {/* Page content */}
        <main
          className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0 print:bg-white"
          style={{ backgroundColor: 'oklch(0.975 0 0)' }}
        >
          <Outlet />
        </main>
      </div>
    </div>
  )
}