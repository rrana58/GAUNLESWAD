
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
