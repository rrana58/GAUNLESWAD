import React, { createContext, useContext, useMemo } from 'react'
import { colors, spacing, typography, shadows, radius, motion, breakpoints } from './index.js'


const ThemeContext = createContext(null)

export function ThemeProvider({ children, app = 'customer' }) {
  const theme = useMemo(() => ({
    app,
    colors,
    spacing,
    typography,
    shadows,
    radius,
    motion,
    breakpoints,
    // Convenience helpers
    getStatusColor: (status) => colors.status[status] ?? colors.status.confirmed,
    getStatusBgClass: (status) => {
      const map = {
        pending: 'bg-amber-100 text-amber-800',
        confirmed: 'bg-blue-100 text-blue-800',
        preparing: 'bg-violet-100 text-violet-800',
        ready: 'bg-emerald-100 text-emerald-800',
        transit: 'bg-cyan-100 text-cyan-800',
        delivered: 'bg-green-100 text-green-800',
        cancelled: 'bg-rose-100 text-rose-800',
      }
      return map[status] ?? map.confirmed
    },
  }), [app])

  return (
    <ThemeContext.Provider value={theme}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) {
    // Graceful fallback — return tokens directly if used outside provider
    return { colors, spacing, typography, shadows, radius, motion, breakpoints }
  }
  return ctx
}

export default ThemeProvider
