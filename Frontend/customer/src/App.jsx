import { Routes, Route, Navigate } from 'react-router-dom'
import MobileShell from '@/components/layout/MobileShell'
import ProtectedRoute from '@/components/layout/ProtectedRoute'

import Home from '@/pages/menu/Home'
import Categories from '@/pages/menu/Categories'
import CategoryDetail from '@/pages/menu/CategoryDetail'
import CelebrationsPage from '@/pages/menu/CelebrationsPage'

import Cart from '@/pages/cart/Cart'
import Checkout from '@/pages/checkout/Checkout'
import OrderTracking from '@/pages/orders/OrderTracking'
import OrderHistory from '@/pages/orders/OrderHistory'
import Subscriptions from '@/pages/subscriptions/Subscriptions'
import Profile from '@/pages/profile/Profile'
import Notifications from '@/pages/notifications/Notifications'
import More from '@/pages/more/More'
import Login from '@/pages/auth/Login'
import Register from '@/pages/auth/Register'
import ForgotPassword from '@/pages/auth/ForgotPassword'
import Terms from '@/pages/legal/Terms'
import Privacy from '@/pages/legal/Privacy'
import ShowcasePage from '@/pages/ShowcasePage'
import KhaltiCallback from '@/pages/payment/KhaltiCallback'
import EsewaCallback from '@/pages/payment/EsewaCallback'

export default function App() {
  return (
    <Routes>
      {/* Auth & Legal screens render full-bleed */}
      <Route path="/login" element={<Login />} />
      <Route path="/register" element={<Register />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/privacy" element={<Privacy />} />
      <Route path="/showcase" element={<ShowcasePage />} />

      {/* Payment gateway callbacks */}
      <Route path="/payment/khalti/verify" element={<KhaltiCallback />} />
      <Route path="/payment/esewa/success" element={<EsewaCallback />} />
      <Route path="/payment/esewa/failure" element={<EsewaCallback />} />

      {/* Everything else sits inside the mobile shell (top bar + bottom nav) */}
      <Route element={<MobileShell />}>
        <Route path="/" element={<Home />} />
        <Route path="/categories" element={<Categories />} />
        <Route path="/category/:categoryId" element={<CategoryDetail />} />
        <Route path="/cart" element={<Cart />} />
        <Route path="/subscriptions" element={<Subscriptions />} />
        <Route path="/celebrations" element={<CelebrationsPage />} />
        <Route path="/track/:orderId" element={<OrderTracking />} />

        <Route path="/checkout" element={<Checkout />} />
        <Route path="/more" element={<More />} />

        <Route element={<ProtectedRoute />}>
          <Route path="/orders" element={<OrderHistory />} />
          <Route path="/profile" element={<Profile />} />
      <Route path="/notifications" element={<Notifications />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
