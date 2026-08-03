/**
 * Shared authentication API — accepts each app's configured axios instance.
 * Preserves existing backend contracts; extends login with optional TOTP fields.
 */
export function createAuthService(api) {
  return {
    login(credentials) {
      return api.post('/auth/login', credentials)
    },

    confirmTotpLogin({ userId, token, totpChallengeToken }) {
      return api.post('/auth/totp/confirm', { userId, token, totpChallengeToken })
    },

    getMe() {
      return api.get('/auth/me')
    },

    refresh(refreshToken) {
      return api.post('/auth/refresh', { refreshToken })
    },

    logout() {
      return api.post('/auth/logout')
    },
  }
}
