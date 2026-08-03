/**
 * Single-flight refresh: concurrent 401s share one /auth/refresh call.
 * Uses fetch (not axios) so this module has no node_modules dependency.
 */
export function attachSingleFlightRefresh(api, {
  apiUrl,
  getRefreshToken,
  setTokens,
  onRefreshFailed,
  loginPath,
}) {
  let refreshPromise = null

  function refreshAccessToken() {
    if (!refreshPromise) {
      const refreshToken = getRefreshToken()
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
