import api from './axios'
import { createAuthService } from '@shared/auth'

const authService = createAuthService(api)

export const authApi = {
  sendRegisterOtp: (phone) => api.post('/auth/register/send-otp', { phone }),
  verifyAndRegister: (payload) => api.post('/auth/register/verify', payload),
  login: (payload) => authService.login(payload),
  confirmTotpLogin: (payload) => authService.confirmTotpLogin(payload),
  sendForgotPasswordOtp: (phone) => api.post('/auth/forgot-password/send-otp', { phone }),
  resetPassword: (payload) => api.post('/auth/forgot-password/reset', payload),
  getMe: () => authService.getMe(),
  getLoginHistory: () => api.get('/auth/login-history'),
  updateProfile: (payload) => api.patch('/auth/profile', payload),
  sendChangePasswordOtp: () => api.post('/auth/change-password/send-otp'),
  changePassword: (payload) => api.post('/auth/change-password', payload),
  updateFcmToken: (fcmToken) => api.post('/auth/fcm-token', { fcmToken }),
  logout: () => authService.logout(),
  logoutAll: () => api.post('/auth/logout-all'),
  deleteAccount: (password) => api.delete('/auth/account', { data: { password } }),
}
