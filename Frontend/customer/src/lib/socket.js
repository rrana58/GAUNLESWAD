import { io } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'

import { getApiUrl } from '@/api/axios'

const API_URL = getApiUrl()
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/v\d+\/?$/, '')

let socket = null


export function getSocket() {
  if (socket) return socket

  socket = io(SOCKET_URL, {
    autoConnect: false,
    transports: ['websocket', 'polling'],
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionDelayMax: 10000,
    auth: (cb) => cb({ token: useAuthStore.getState().accessToken }),
  })

  return socket
}

export function connectSocket() {
  const s = getSocket()
  if (!s.connected) s.connect()
  return s
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}