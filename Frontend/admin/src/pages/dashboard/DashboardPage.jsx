import { useQuery } from '@tanstack/react-query'
import { Link } from 'react-router-dom'
import { getStats, getRevenue, getTopItems } from '@/api/admin'
import { getOrders } from '@/api/orders'
import { ShoppingBag, TrendingUp, Users, Clock } from 'lucide-react'
import { format } from 'date-fns'
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid,
  Tooltip, ResponsiveContainer
} from 'recharts'
import Spinner from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import StatusBadge from '@/components/ui/StatusBadge'

/**
 * DashboardPage — Design System: Phase 5.2
 *
 * Token changes:
 *  - Removed local StatCard definition → shared StatCard component
 *  - Removed local statusColors map → StatusBadge component
 *  - bg-white → bg-card on all section/panel elements
 *  - bg-gray-50 → bg-muted on table hover rows + empty state
 *  - text-gray-900 → text-foreground
 *  - text-gray-500 → text-muted-foreground
 *  - text-gray-400 → text-muted-foreground/60
 *  - border-gray-100 → border-border
 *  - divide-gray-50 → divide-border
 *  - rounded-xl → var(--gs-admin-radius-xl) via style
 *  - Loader2 animate-spin → <Spinner>
 *  - Chart stroke="#f97316" → var(--gs-admin-accent) read at runtime
 *  - Chart dot fill="#f97316" → same
 *  - "View all →" link text-orange-500/600 → text-[var(--gs-admin-accent)]
 *  - Top items revenue text-green-600 → intentional semantic (positive $ = green)
 *
 * Accessibility:
 *  - <main aria-label="Dashboard overview"> wraps all content
 *  - <header> for page title section
 *  - Stats grid: role="list" + each StatCard has role="region" aria-label
 *  - Revenue chart: role="region" aria-label + sr-only description (preserved)
 *  - Top items: <section aria-label> + <ul>/<li> for item list
 *  - Recent orders: <section aria-label>
 *  - Table: aria-label + scope="col" on all <th>
 *  - Status spans → <StatusBadge> with built-in aria-label
 *  - Order number link → aria-label="View order #N"
 *  - "View all" link → aria-label preserved + aria-hidden on →
 *  - Spinner: role="status" aria-label
 *  - TrendingUp/ShoppingBag/Users/Clock icons → aria-hidden inside StatCard
 *
 * No API, query, or data logic changed.
 */

// Read --gs-admin-accent at runtime so charts respect the CSS token
// (Recharts stroke/fill only accept string values, not CSS variables)
const getAdminAccent = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--gs-admin-accent')
    .trim() || '#f97316'

export default function DashboardPage() {
  const { data: statsData, isLoading: statsLoading } = useQuery({
    queryKey: ['stats'],
    queryFn: () => getStats().then(r => r.data.stats),
    refetchInterval: 30000,
  })

  const { data: revenueData } = useQuery({
    queryKey: ['revenue', 'week'],
    queryFn: () => getRevenue({ period: 'week' }).then(r => r.data.analytics),
  })

  const { data: ordersData } = useQuery({
    queryKey: ['orders', 'recent'],
    queryFn: () => getOrders({ limit: 8, page: 1 }).then(r => r.data),
    refetchInterval: 15000,
  })

  const { data: topItemsData } = useQuery({
    queryKey: ['topItems'],
    queryFn: () => getTopItems().then(r => r.data.topItems),
  })

  if (statsLoading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Spinner size="lg" label="Loading dashboard statistics…" />
      </div>
    )
  }

  const stats = statsData || {}
  const accent = getAdminAccent()

  return (
    <main className="space-y-6" aria-label="Dashboard overview">
      <header>
        <h1 className="text-2xl font-bold text-foreground">Dashboard</h1>
        <p className="text-muted-foreground text-sm mt-1">
          {format(new Date(), 'EEEE, MMMM d yyyy')} · Gharko Swad Cloud Kitchen
        </p>
      </header>

      {/* Stat cards */}
      <section aria-label="Quick statistics">
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4" role="list">
          <div role="listitem">
            <StatCard
              title="Today's Orders"
              value={stats.todayOrders ?? 0}
              icon={ShoppingBag}
              description="Orders placed today"
              accentColor="var(--gs-admin-accent)"
            />
          </div>
          <div role="listitem">
            <StatCard
              title="Today's Revenue"
              value={`Rs. ${(stats.todayRevenue ?? 0).toLocaleString()}`}
              icon={TrendingUp}
              description="From non-cancelled orders"
              accentColor="oklch(0.527 0.154 150.069)"
            />
          </div>
          <div role="listitem">
            <StatCard
              title="Pending Orders"
              value={stats.pendingOrders ?? 0}
              icon={Clock}
              description="Needs attention"
              accentColor="oklch(0.795 0.184 86.047)"
            />
          </div>
          <div role="listitem">
            <StatCard
              title="Total Customers"
              value={stats.totalUsers ?? 0}
              icon={Users}
              description={`${stats.totalMenuItems ?? 0} menu items active`}
              accentColor="oklch(0.546 0.185 264.376)"
            />
          </div>
        </div>
      </section>

      {/* Revenue chart + Top items */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Revenue chart */}
        <section
          className="lg:col-span-2 bg-card border border-border p-5"
          role="region"
          aria-label="Revenue chart — last 7 days"
          style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
        >
          <h2 className="font-semibold text-foreground mb-4">Revenue — Last 7 Days</h2>
          <div className="sr-only">
            Line chart showing daily revenue for the last seven days.
          </div>
          {revenueData?.length ? (
            <ResponsiveContainer width="100%" height={220}>
              <LineChart
                data={revenueData}
                margin={{ top: 5, right: 20, bottom: 5, left: 0 }}
              >
                <CartesianGrid strokeDasharray="3 3" stroke="oklch(0.922 0 0)" />
                <XAxis
                  dataKey="_id"
                  tick={{ fontSize: 11 }}
                  tickFormatter={(v) => format(new Date(v), 'MMM d')}
                />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip
                  formatter={(v) => [`Rs. ${v.toLocaleString()}`, 'Revenue']}
                  labelFormatter={(v) => format(new Date(v), 'MMM d, yyyy')}
                />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={accent}
                  strokeWidth={2}
                  dot={{ fill: accent, r: 4 }}
                />
              </LineChart>
            </ResponsiveContainer>
          ) : (
            <div
              className="h-55 flex items-center justify-center text-muted-foreground text-sm"
              role="status"
              aria-label="No revenue data available yet"
            >
              No revenue data yet
            </div>
          )}
        </section>

        {/* Top items */}
        <section
          className="bg-card border border-border p-5"
          aria-label="Top menu items"
          style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
        >
          <h2 className="font-semibold text-foreground mb-4">Top Menu Items</h2>
          <ul className="space-y-3" aria-label="Best-selling menu items">
            {topItemsData?.length ? topItemsData.slice(0, 6).map((item, i) => (
              <li
                key={item._id}
                className="flex items-center gap-3"
                aria-label={`#${i + 1}: ${item.name}, ${item.totalSold} sold, Rs. ${item.revenue?.toLocaleString()}`}
              >
                <span
                  className="text-xs font-bold text-muted-foreground/60 w-4"
                  aria-hidden="true"
                >
                  {i + 1}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
                  <p className="text-xs text-muted-foreground">{item.totalSold} sold</p>
                </div>
                <span className="text-xs font-medium text-green-600" aria-hidden="true">
                  Rs. {item.revenue?.toLocaleString()}
                </span>
              </li>
            )) : (
              <li className="text-sm text-muted-foreground" role="status">No data yet</li>
            )}
          </ul>
        </section>
      </div>

      {/* Recent orders */}
      <section
        className="bg-card border border-border p-5"
        aria-label="Recent orders"
        style={{ borderRadius: 'var(--gs-admin-radius-xl)' }}
      >
        <div className="flex items-center justify-between mb-4">
          <h2 className="font-semibold text-foreground">Recent Orders</h2>
          <Link
            to="/orders"
            className="text-sm font-medium hover:underline gs-admin-focus-ring px-1 rounded-sm"
            style={{ color: 'var(--gs-admin-accent)' }}
            aria-label="View all orders"
          >
            View all <span aria-hidden="true">→</span>
          </Link>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm" aria-label="Recent customer orders">
            <thead>
              <tr
                className="text-left text-muted-foreground text-xs border-b border-border"
              >
                <th scope="col" className="pb-3 font-medium">Order</th>
                <th scope="col" className="pb-3 font-medium">Customer</th>
                <th scope="col" className="pb-3 font-medium">Items</th>
                <th scope="col" className="pb-3 font-medium">Total</th>
                <th scope="col" className="pb-3 font-medium">Status</th>
                <th scope="col" className="pb-3 font-medium">Time</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {ordersData?.orders?.length ? ordersData.orders.map((order) => (
                <tr
                  key={order._id}
                  className="hover:bg-muted transition-colors"
                >
                  <td className="py-3 font-mono text-xs text-muted-foreground">
                    <Link
                      to={`/orders/${order._id}`}
                      className="hover:underline gs-admin-focus-ring rounded-sm"
                      style={{ color: 'var(--gs-admin-accent)' }}
                      aria-label={`View order #${order.orderNumber}`}
                    >
                      #{order.orderNumber}
                    </Link>
                  </td>
                  <td className="py-3 text-foreground">
                    {order.customer?.name || order.guestInfo?.name || 'Guest'}
                  </td>
                  <td className="py-3 text-muted-foreground">
                    {order.items?.length} item{order.items?.length !== 1 ? 's' : ''}
                  </td>
                  <td className="py-3 font-medium text-foreground">
                    Rs. {order.totalAmount?.toLocaleString()}
                  </td>
                  <td className="py-3">
                    <StatusBadge status={order.status} size="sm" />
                  </td>
                  <td className="py-3 text-muted-foreground/60 text-xs">
                    {format(new Date(order.createdAt), 'h:mm a')}
                  </td>
                </tr>
              )) : (
                <tr>
                  <td
                    colSpan={6}
                    className="py-8 text-center text-muted-foreground"
                    role="status"
                  >
                    No orders yet today
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  )
}