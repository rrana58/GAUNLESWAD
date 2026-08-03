import api from './axios'
import { createAuthService } from '@shared/auth'

const authService = createAuthService(api)

export const login = (phone, password) =>
  authService.login({ phone, password })

export const verifyTotp = (userId, token, totpChallengeToken) =>
  authService.confirmTotpLogin({ userId, token, totpChallengeToken })

export const getMe = () => authService.getMe()
