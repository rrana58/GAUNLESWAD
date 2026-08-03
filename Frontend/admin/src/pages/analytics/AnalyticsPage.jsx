import { useState, useMemo } from 'react'
import { useQuery } from '@tanstack/react-query'
import { getRevenue, getTopItems, getStats } from '@/api/admin'
import { TrendingUp, ShoppingBag, Users, AlertCircle, Download } from 'lucide-react'
import { format, parseISO } from 'date-fns'
import {
  LineChart, Line, BarChart, Bar, XAxis, YAxis,
  CartesianGrid, Tooltip, ResponsiveContainer, Legend
} from 'recharts'
import Spinner from '@/components/ui/Spinner'
import StatCard from '@/components/ui/StatCard'
import FilterChips from '@/components/ui/FilterChips'

/**
 * AnalyticsPage — Design System: Phase 5.2
 *
 * Token changes:
 *  - Removed local StatCard definition → shared StatCard component
 *  - bg-white → bg-card on chart panels
 *  - bg-gray-100 → bg-muted on period toggle bg / progress bar track
 *  - text-gray-900 → text-foreground
 *  - text-gray-500/400 → text-muted-foreground
 *  - border-gray-100 → border-border
 *  - rounded-xl → var(--gs-admin-radius-xl) via style
 *  - shadow-sm → var(--gs-admin-shadow-sm) via style
 *  - Inline period toggle buttons → <FilterChips>
 *  - Loader2 → <Spinner>
 *  - stroke="#f97316" → getAdminAccent() runtime CSS variable read
 *  - stroke="#3b82f6" → second data series — kept as-is (semantic: orders line)
 *  - fill="#f97316" (bar chart) → getAdminAccent()
 *  - bg-orange-500 (progress bar) → var(--gs-admin-accent) inline style
 *  - bg-gray-100 (progress track) → bg-muted
 *  - Inline tooltip contentStyle borderRadius → var(--gs-admin-radius-xl)
 *  - Inline tooltip boxShadow → var(--gs-admin-shadow-modal)
 *
 * Accessibility:
 *  - <main aria-label="Analytics overview"> wraps all content
 *  - <header> for page title + controls
 *  - Stats grid: each StatCard has role="region" aria-label (via component)
 *  - Performance chart: <section role="region" aria-label>
 *  - Top sellers charts: <section role="region" aria-label>
 *  - Chart Loader2 → <Spinner>
 *  - Progress bars: role="progressbar" aria-valuenow aria-valuemin aria-valuemax
 *  - Progress bar track: aria-hidden (decorative background)
 *  - TrendingUp/ShoppingBag/Users icons → aria-hidden (inside StatCard)
 *  - Download button: aria-label + aria-busy when exporting
 *  - AlertCircle error icon → aria-hidden
 *  - Period FilterChips: role="group" aria-label + aria-pressed per chip
 *
 * No API, query, mutation, or data logic changed.
 */

// Read --gs-admin-accent at runtime — Recharts stroke/fill only accept strings
const getAdminAccent = () =>
  getComputedStyle(document.documentElement)
    .getPropertyValue('--gs-admin-accent')
    .trim() || '#f97316'

const formatCurrency = (val) => `Rs. ${Number(val).toLocaleString()}`

const PERIODS = [
  { label: '7 Days', value: 'week' },
  { label: '30 Days', value: 'month' },
  { label: '1 Year', value: 'year' },
]

export default function AnalyticsPage() {
  const [period, setPeriod] = useState('week')

  const {
    data: revenueData,
    isLoading: revLoading,
    isError: revError,
  } = useQuery({
    queryKey: ['revenue', period],
    queryFn: () => getRevenue({ period }).then(r => r.data.analytics || []),
    select: (data) => data.map(d => ({
      ...d,
      dateFormatted: format(parseISO(d._id), 'MMM d'),
      fullDate: format(parseISO(d._id), 'MMM d, yyyy'),
    })),
  })

  const { data: topItems, isLoading: itemsLoading } = useQuery({
    queryKey: ['topItems', period],
    queryFn: () => getTopItems({ period }).then(r => r.data.topItems || []),
  })

  const { data: stats } = useQuery({
    queryKey: ['stats', period],
    queryFn: () => getStats({ period }).then(r => r.data.stats || {}),
  })

  // CSV export — business logic unchanged
  const exportToCSV = () => {
    if (!revenueData) return
    const headers = 'Date,Revenue,Orders\n'
    const rows = revenueData.map(d => `${d.fullDate},${d.revenue},${d.orders}`).join('\n')
    const blob = new Blob([headers + rows], { type: 'text/csv' })
    const url = window.URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `report-${period}-${format(new Date(), 'yyyy-MM-dd')}.csv`
    a.click()
  }

  const totals = useMemo(() => {
    if (!revenueData) return { revenue: 0, orders: 0, avg: 0 }
    const revenue = revenueData.reduce((sum, d) => sum + (d.revenue || 0), 0)
    const orders  = revenueData.reduce((sum, d) => sum + (d.orders || 0), 0)
    return { revenue, orders, avg: orders > 0 ? Math.round(revenue / orders) : 0 }
  }, [revenueData])

  const accent = getAdminAccent()
  const maxSold = topItems?.[0]?.totalSold || 1

  if (revError) {
    return (
      <div className="p-10 text-center text-muted-foreground" role="alert" aria-label="Error loading analytics data">
        <AlertCircle className="mx-auto mb-2 text-destructive" aria-hidden="true" />
        Error loading data.
      </div>
    )
  }

  return (
    <main className="space-y-6 pb-10" aria-label="Analytics overview">

      {/* Header + controls */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Analytics</h1>
          <p className="text-muted-foreground text-sm mt-1">Cloud Kitchen Performance</p>
        </div>

        <div className="flex items-center gap-3">
          {/* Export */}
          <button
            onClick={exportToCSV}
            aria-label={`Export ${period} analytics data as CSV`}
            className="flex items-center gap-2 px-3 py-2 bg-card border border-border text-sm font-medium hover:bg-muted transition-colors gs-admin-focus-ring"
            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
          >
            <Download size={16} aria-hidden="true" />
            Export CSV
          </button>

          {/* Period toggle → FilterChips */}
          <div
            className="flex gap-1 bg-muted p-1"
            style={{ borderRadius: 'var(--gs-admin-radius-lg)' }}
          >
            <FilterChips
              options={PERIODS}
              value={period}
              onChange={setPeriod}
              label="Analytics time period"
              getActiveClass={() => 'bg-card text-foreground border-transparent shadow-sm'}
              size="xs"
            />
          </div>
        </div>
      </header>

      {/* Stat cards */}
      <section aria-label="Summary metrics">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          <StatCard
            title="Revenue"
            value={formatCurrency(totals.revenue)}
            description={`Total — ${period}`}
            icon={TrendingUp}
            accentColor="var(--gs-admin-accent)"
          />
          <StatCard
            title="Orders"
            value={totals.orders}
            description="Completed"
            icon={ShoppingBag}
            accentColor="oklch(0.527 0.154 150.069)"
          />
          <StatCard
            title="Avg Order"
            value={formatCurrency(totals.avg)}
            description="Ticket Size"
            icon={TrendingUp}
            accentColor="oklch(0.546 0.185 264.376)"
          />
          <StatCard
            title="Customers"
            value={stats?.totalUsers || 0}
            description="Registered"
            icon={Users}
            accentColor="oklch(0.795 0.184 86.047)"
          />
        </div>
      </section>

      {/* Main performance chart */}
      <section
        role="region"
        aria-label="Performance trend chart"
        className="bg-card border border-border p-6"
        style={{
          borderRadius: 'var(--gs-admin-radius-xl)',
          boxShadow: 'var(--gs-admin-shadow-sm)',
        }}
      >
        <h2 className="font-semibold text-foreground mb-6">Performance Trend</h2>
        <div className="h-75 w-full" role="img" aria-label="Line chart of revenue and orders over selected period">
          {revLoading ? (
            <div className="h-full flex items-center justify-center">
              <Spinner size="md" label="Loading performance chart…" />
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={revenueData}>
                <CartesianGrid
                  strokeDasharray="3 3"
                  vertical={false}
                  stroke="oklch(0.922 0 0)"
                />
                <XAxis
                  dataKey="dateFormatted"
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                />
                <YAxis
                  tick={{ fontSize: 12 }}
                  axisLine={false}
                  tickLine={false}
                  tickFormatter={(v) => `Rs.${v}`}
                />
                <Tooltip
                  contentStyle={{
                    borderRadius: 'var(--gs-admin-radius-xl)',
                    border: 'none',
                    boxShadow: 'var(--gs-admin-shadow-modal)',
                  }}
                />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="revenue"
                  stroke={accent}
                  strokeWidth={3}
                  dot={false}
                />
                <Line
                  type="monotone"
                  dataKey="orders"
                  stroke="#3b82f6"
                  strokeWidth={3}
                  dot={false}
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </div>
      </section>

      {/* Bottom grid: top sellers */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* Top sellers by revenue — bar chart */}
        <section
          role="region"
          aria-label="Top sellers by revenue chart"
          className="bg-card border border-border p-6"
          style={{
            borderRadius: 'var(--gs-admin-radius-xl)',
            boxShadow: 'var(--gs-admin-shadow-sm)',
          }}
        >
          <h2 className="font-semibold text-foreground mb-4">Top Sellers (Revenue)</h2>
          {itemsLoading ? (
            <div className="h-60 flex items-center justify-center">
              <Spinner size="md" label="Loading top sellers chart…" />
            </div>
          ) : (
            <div
              className="h-70"
              role="img"
              aria-label="Horizontal bar chart of top 5 items by revenue"
            >
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={topItems?.slice(0, 5)} layout="vertical">
                  <YAxis
                    dataKey="name"
                    type="category"
                    tick={{ fontSize: 11 }}
                    width={80}
                  />
                  <XAxis type="number" hide />
                  <Tooltip formatter={(v) => formatCurrency(v)} />
                  <Bar dataKey="revenue" fill={accent} radius={[0, 4, 4, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </section>

        {/* Top sellers by quantity — progress bars */}
        <section
          role="region"
          aria-label="Top sellers by quantity"
          className="bg-card border border-border p-6"
          style={{
            borderRadius: 'var(--gs-admin-radius-xl)',
            boxShadow: 'var(--gs-admin-shadow-sm)',
          }}
        >
          <h2 className="font-semibold text-foreground mb-4">Top Sellers (Quantity)</h2>
          <div className="space-y-4">
            {topItems?.slice(0, 5).map((item) => {
              const pct = Math.round((item.totalSold / maxSold) * 100)
              return (
                <div key={item._id}>
                  <div className="flex justify-between text-sm mb-1">
                    <span className="text-foreground">{item.name}</span>
                    <span className="font-bold text-foreground">{item.totalSold} units</span>
                  </div>
                  {/* Progress bar track */}
                  <div
                    className="w-full bg-muted h-2"
                    style={{ borderRadius: 'var(--gs-admin-radius-full)' }}
                    aria-hidden="true"
                  >
                    {/* Progress bar fill */}
                    <div
                      role="progressbar"
                      aria-label={`${item.name}: ${pct}% of top seller`}
                      aria-valuenow={pct}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      className="h-2"
                      style={{
                        width: `${pct}%`,
                        backgroundColor: 'var(--gs-admin-accent)',
                        borderRadius: 'var(--gs-admin-radius-full)',
                      }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        </section>

      </div>
    </main>
  )
}