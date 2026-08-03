import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { getRoleRedirectUrl, isCapacitorNative } from '@shared/auth'

/** True once zustand's persist middleware has finished reading auth state
 *  back from localStorage. Uses the official persist API rather than
 *  hand-rolled state, so it can't get permanently stuck if hydration
 *  finishes in a way a custom callback might miss. Also checks
 *  hasHydrated() directly on mount, in case hydration already completed
 *  before this component subscribed. */
function useAuthHydrated() {
  const [hydrated, setHydrated] = useState(() => useAuthStore.persist.hasHydrated())

  useEffect(() => {
    if (useAuthStore.persist.hasHydrated()) {
      setHydrated(true)
      return
    }
    const unsub = useAuthStore.persist.onFinishHydration(() => setHydrated(true))

    const timeout = setTimeout(() => setHydrated(true), 1000)

    return () => {
      unsub()
      clearTimeout(timeout)
    }
  }, [])

  return hydrated
}

export default function ProtectedRoute() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const user = useAuthStore((s) => s.user)
  const hydrated = useAuthHydrated()
  const location = useLocation()

  if (!hydrated) {
    return null
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" replace state={{ from: location }} />
  }

  return <Outlet />
}
