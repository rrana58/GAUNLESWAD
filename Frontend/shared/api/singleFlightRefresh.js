
export function attachSingleFlightRefresh(api, {
  apiUrl,
  getRefreshToken,
  setTokens,
  onRefreshFailed,
  loginPath,
  storageKey,
}) {
  let refreshPromise = null

  function readPersistedTokens() {
    if (!storageKey) return null
    try {
      const raw = localStorage.getItem(storageKey)
      if (!raw) return null
      const parsed = JSON.parse(raw)
      return parsed?.state || null
    } catch {
      return null
    }
  }

  function refreshAccessToken() {
    if (!refreshPromise) {
      const refreshToken = getRefreshToken()

      
      const persistedBefore = readPersistedTokens()
      if (persistedBefore?.refreshToken && persistedBefore.refreshToken !== refreshToken && persistedBefore.accessToken) {
        setTokens({ accessToken: persistedBefore.accessToken, refreshToken: persistedBefore.refreshToken, user: persistedBefore.user })
        return Promise.resolve(persistedBefore.accessToken)
      }

      if (!refreshToken) return Promise.reject(new Error('No refresh token'))

      refreshPromise = fetch(`${apiUrl}/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      })
        .then(async (res) => {
          const data = await res.json().catch(() => ({}))
          if (!res.ok) {
            const err = new Error(data.message || 'Refresh failed')
            err.response = { status: res.status, data }
            throw err
          }
          setTokens(data)
          return data.accessToken
        })
        .catch((err) => {
          
          const persistedAfter = readPersistedTokens()
          if (persistedAfter?.refreshToken && persistedAfter.refreshToken !== refreshToken && persistedAfter.accessToken) {
            setTokens({ accessToken: persistedAfter.accessToken, refreshToken: persistedAfter.refreshToken, user: persistedAfter.user })
            return persistedAfter.accessToken
          }
          onRefreshFailed?.()
          throw err
        })
        .finally(() => {
          refreshPromise = null
        })
    }
    return refreshPromise
  }

  api.interceptors.response.use(
    (res) => res,
    async (err) => {
      const originalRequest = err.config

      if (
        err.response?.status === 401 &&
        !originalRequest._retry &&
        !originalRequest.url?.includes('/auth/')
      ) {
        originalRequest._retry = true
        try {
          const newAccessToken = await refreshAccessToken()
          originalRequest.headers.Authorization = `Bearer ${newAccessToken}`
          return api(originalRequest)
        } catch {
          if (loginPath) window.location.href = loginPath
          return Promise.reject(err)
        }
      }

      return Promise.reject(err)
    }
  )

  return { refreshAccessToken }
}