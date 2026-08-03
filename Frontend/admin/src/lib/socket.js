import { io } from 'socket.io-client'
import { useAuthStore } from '@/store/authStore'

// The API URL points at .../api/v1 — Socket.IO is mounted on the bare server origin.
const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
const SOCKET_URL = import.meta.env.VITE_SOCKET_URL || API_URL.replace(/\/api\/v\d+\/?$/, '')

let socket = null

/**
 * Returns the singleton admin socket, creating it (in a disconnected state)
 * on first call. The auth token is read fresh on every (re)connect attempt
 * so a rotated access token is always picked up automatically.
 */
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

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
