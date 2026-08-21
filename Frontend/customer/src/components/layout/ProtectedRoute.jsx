import { useEffect, useState } from 'react'
import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { getRoleRedirectUrl, isCapacitorNative } from '@shared/auth'


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
