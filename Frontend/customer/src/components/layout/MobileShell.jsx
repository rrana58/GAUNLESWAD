import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import { AlertTriangle } from 'lucide-react'
import BottomNav from './BottomNav'
import TopBar from './TopBar'
import ActiveOrderBar from '@/components/orders/ActiveOrderBar'
import ItemDetailModal from '@/components/menu/ItemDetailModal'
import MarketingPopup from '@/components/marketing/MarketingPopup'
import { useSwipeBack } from '@/hooks/useSwipeBack'
import { useAuthStore } from '@/store/authStore'
import { useSettingsStore } from '@/store/settingsStore'
import { initPushNotifications } from '@/utils/pushNotifications'


export default function MobileShell() {
  useSwipeBack()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const footerRef = useRef(null)
  const [footerHeight, setFooterHeight] = useState(64) // fallback ≈ bottom nav height
  const fetchSettings = useSettingsStore((s) => s.fetchSettings)
  const maintenanceMode = useSettingsStore((s) => s.maintenanceMode)
  const maintenanceMessage = useSettingsStore((s) => s.maintenanceMessage)

  useEffect(() => {
    fetchSettings()
  }, [fetchSettings])

  useLayoutEffect(() => {
    const el = footerRef.current
    if (!el) return
    const observer = new ResizeObserver(([entry]) => setFooterHeight(entry.contentRect.height))
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <TopBar />
      {maintenanceMode && (
        <div
          role="status"
          className="flex items-start gap-2 px-4 py-2.5 text-sm font-medium bg-destructive/10 text-destructive border-b border-destructive/20"
        >
          <AlertTriangle size={16} className="shrink-0 mt-0.5" aria-hidden="true" />
          <span>{maintenanceMessage || "We're temporarily not accepting new orders. You can still browse the menu."}</span>
        </div>
      )}
      <main
        className="flex-1 overflow-y-auto"
        style={{ paddingBottom: `calc(${footerHeight}px + env(safe-area-inset-bottom) + 0.5rem)` }}
      >
        <Outlet />
      </main>
      <div ref={footerRef} className="fixed bottom-0 inset-x-0 z-40">
        <ActiveOrderBar />
        <BottomNav />
      </div>
      
      {/* Global Modals */}
      <ItemDetailModal />
      <MarketingPopup />
    </div>
  )
}