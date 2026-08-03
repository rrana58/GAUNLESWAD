import { lazy, Suspense } from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { getRoleRedirectUrl } from '@shared/auth'
import AdminLayout from '@/components/layout/AdminLayout'
import LoginPage from '@/pages/auth/LoginPage'
import Spinner from '@/components/ui/Spinner'

// Lazy-loaded pages — each becomes its own chunk, fetched on navigation
const DashboardPage = lazy(() => import('@/pages/dashboard/DashboardPage'))
const OrdersPage = lazy(() => import('@/pages/orders/OrdersPage'))
const OrderDetailPage = lazy(() => import('@/pages/orders/OrderDetailPage'))
const MenuPage = lazy(() => import('@/pages/menu/MenuPage'))
const SessionsPage = lazy(() => import('@/pages/sessions/SessionsPage'))
const CouponsPage = lazy(() => import('@/pages/coupons/CouponsPage'))
const SubscriptionsPage = lazy(() => import('@/pages/subscriptions/SubscriptionsPage'))
const CelebrationsPage = lazy(() => import('@/pages/celebrations/CelebrationsPage'))
const ClosedDatesPage = lazy(() => import('@/pages/closed-dates/ClosedDatesPage'))
const AnalyticsPage = lazy(() => import('@/pages/analytics/AnalyticsPage'))
const UsersPage = lazy(() => import('@/pages/users/UsersPage'))
const SettingsPage = lazy(() => import('@/pages/settings/SettingsPage'))
const ReviewsPage = lazy(() => import('@/pages/reviews/ReviewsPage'))
const AnnouncementsPage = lazy(() => import('@/pages/announcements/AnnouncementsPage'))
const JobsPage = lazy(() => import('@/pages/jobs/JobsPage'))
const JobApplicationsPage = lazy(() => import('@/pages/jobs/JobApplicationsPage'))

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: 1,
      staleTime: 30 * 1000,
    },
  },
})

function ProtectedRoute({ children }) {
  const { isAuthenticated, user } = useAuthStore()

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace />
  }

  if (user.role !== 'admin') {
    const targetUrl = getRoleRedirectUrl(user.role)
    window.location.href = targetUrl
    return null
  }

  return children
}

function PageFallback() {
  return (
    <div className="flex h-full min-h-[50vh] items-center justify-center bg-background">
      <Spinner size="md" label="Loading page…" />
    </div>
  )
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <BrowserRouter basename="/admin">
        <Suspense fallback={<PageFallback />}>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AdminLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<DashboardPage />} />
              <Route path="orders" element={<OrdersPage />} />
              <Route path="orders/:id" element={<OrderDetailPage />} />
              <Route path="menu" element={<MenuPage />} />
              <Route path="sessions" element={<SessionsPage />} />
              <Route path="coupons" element={<CouponsPage />} />
              <Route path="subscriptions" element={<SubscriptionsPage />} />
              <Route path="celebrations" element={<CelebrationsPage />} />
              <Route path="closed-dates" element={<ClosedDatesPage />} />
              <Route path="reviews" element={<ReviewsPage />} />
              <Route path="announcements" element={<AnnouncementsPage />} />
              <Route path="jobs" element={<JobsPage />} />
              <Route path="jobs/applications" element={<JobApplicationsPage />} />
              <Route path="analytics" element={<AnalyticsPage />} />
              <Route path="users" element={<UsersPage />} />
              <Route path="settings" element={<SettingsPage />} />
            </Route>
          </Routes>
        </Suspense>
      </BrowserRouter>
      <Toaster position="top-right" richColors />
    </QueryClientProvider>
  )
}