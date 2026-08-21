import axios from 'axios'
import { useAuthStore } from '@/store/authStore'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})


const AUTH_STORAGE_KEY = 'gharko-swad-auth'
let refreshPromise = null

function readPersistedTokens() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY)
    if (!raw) return null
    return JSON.parse(raw)?.state || null
  } catch {
    return null
  }
}

function refreshAccessToken() {
  if (!refreshPromise) {
    const refreshToken = useAuthStore.getState().refreshToken

    // Another tab may have already rotated this exact token — adopt its
    // result instead of sending a token we can already tell is stale.
    const persistedBefore = readPersistedTokens()
    if (persistedBefore?.refreshToken && persistedBefore.refreshToken !== refreshToken && persistedBefore.accessToken) {
      useAuthStore.getState().setAuth(persistedBefore.user, persistedBefore.accessToken, persistedBefore.refreshToken)
      return Promise.resolve(persistedBefore.accessToken)
    }

    if (!refreshToken) return Promise.reject(new Error('No refresh token'))

    refreshPromise = axios
      .post(`${API_URL}/auth/refresh`, { refreshToken })
      .then(({ data }) => {
        // Backend returns tokens flat: { success, accessToken, refreshToken, user }
        const user = data.user || useAuthStore.getState().user
        useAuthStore.getState().setAuth(user, data.accessToken, data.refreshToken)
        return data.accessToken
      })
      .catch((err) => {
        // Another tab may have refreshed while our request was in flight —
        // if so, this isn't actually a dead session.
        const persistedAfter = readPersistedTokens()
        if (persistedAfter?.refreshToken && persistedAfter.refreshToken !== refreshToken && persistedAfter.accessToken) {
          useAuthStore.getState().setAuth(persistedAfter.user, persistedAfter.accessToken, persistedAfter.refreshToken)
          return persistedAfter.accessToken
        }
        useAuthStore.getState().logout()
        throw err
      })
      .finally(() => {
        refreshPromise = null
      })
  }
  return refreshPromise
}

/** Decodes a JWT's payload without verifying the signature — fine for a
 *  client-side "is this worth sending" check; the server still verifies
 *  it properly. Treats anything unparsable as expired (safest default). */
function isTokenExpired(token, bufferSeconds = 15) {
  if (!token) return true
  try {
    const payload = JSON.parse(atob(token.split('.')[1]))
    if (!payload.exp) return false
    return Date.now() >= (payload.exp - bufferSeconds) * 1000
  } catch {
    return true
  }
}

// Proactively refresh BEFORE sending, rather than waiting for a 401 —
// critical because optionalAuth routes (like /orders, which supports guest
// checkout) never return 401 for an expired token; they silently proceed
// as an unauthenticated guest instead. Reactive-only refresh would mean an
// expired token silently downgrades a logged-in customer's order to a
// guest order — no subscription discount, no loyalty points, no history.
api.interceptors.request.use(async (config) => {
  const { accessToken, refreshToken, isAuthenticated } = useAuthStore.getState()

  if (isAuthenticated && accessToken && isTokenExpired(accessToken) && refreshToken) {
    try {
      const newToken = await refreshAccessToken()
      config.headers.Authorization = `Bearer ${newToken}`
      return config
    } catch {
      // Refresh failed (refresh token itself expired/invalid) — proceed
      // unauthenticated; the response interceptor below will redirect to
      // login if the endpoint actually required auth.
      return config
    }
  }

  if (accessToken) config.headers.Authorization = `Bearer ${accessToken}`
  return config
})

// Reactive fallback — still needed for routes that DO require auth (protect,
// not optionalAuth) and for the rare case a token expires mid-flight.
api.interceptors.response.use(
  (res) => res,
  async (err) => {
    const originalRequest = err.config

    if (err.response?.status === 401 && !originalRequest._retry && !originalRequest.url?.includes('/auth/')) {
      originalRequest._retry = true
      try {
        const newAccessToken = await refreshAccessToken()
        originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
        return api(originalRequest)
      } catch {
        window.location.href = '/login'
        return Promise.reject(err)
      }
    }

    return Promise.reject(err)
  }
)

export default api