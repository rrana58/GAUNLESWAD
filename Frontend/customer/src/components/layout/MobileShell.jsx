import { useRef, useLayoutEffect, useState, useEffect } from 'react'
import { Outlet, useNavigate } from 'react-router-dom'
import BottomNav from './BottomNav'
import TopBar from './TopBar'
import ActiveOrderBar from '@/components/orders/ActiveOrderBar'
import ItemDetailModal from '@/components/menu/ItemDetailModal'
import MarketingPopup from '@/components/marketing/MarketingPopup'
import { useSwipeBack } from '@/hooks/useSwipeBack'
import { useAuthStore } from '@/store/authStore'
import { initPushNotifications } from '@/utils/pushNotifications'

/** Shared shell for all main tabs: scrollable content area + fixed footer
 *  (ActiveOrderBar + BottomNav stacked together, both pinned to the bottom).
 *  ActiveOrderBar only renders when there's an order in progress, so the
 *  footer's height changes dynamically — a ResizeObserver keeps the
 *  content's bottom padding in sync so nothing ever sits hidden behind it.
 *  Edge-swipe-to-go-back is active shell-wide (the hook itself excludes the
 *  home/landing screen). */
export default function MobileShell() {
  useSwipeBack()
  const navigate = useNavigate()
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const footerRef = useRef(null)
  const [footerHeight, setFooterHeight] = useState(64) // fallback ≈ bottom nav height

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
