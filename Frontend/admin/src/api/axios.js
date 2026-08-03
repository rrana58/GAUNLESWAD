import axios from 'axios'
import { useAuthStore } from '@/store/authStore'
import { attachSingleFlightRefresh } from '@shared/api/singleFlightRefresh'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'

const api = axios.create({
  baseURL: API_URL,
  headers: { 'Content-Type': 'application/json' },
})

api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken
  if (token) {
    config.headers.Authorization = `Bearer ${token}`
  }
  return config
})

attachSingleFlightRefresh(api, {
  apiUrl: API_URL,
  getRefreshToken: () => useAuthStore.getState().refreshToken,
  setTokens: (data) => {
    const user = data.user || useAuthStore.getState().user
    useAuthStore.getState().setAuth(user, data.accessToken, data.refreshToken)
  },
  onRefreshFailed: () => useAuthStore.getState().logout?.(),
  loginPath: '/login',
})

export default api
