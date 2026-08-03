import { io } from 'socket.io-client'

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:5000/api/v1'
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
    auth: (cb) => cb({ token: localStorage.getItem('token') }),
  })

  return socket
}

export function disconnectSocket() {
  if (socket?.connected) socket.disconnect()
}
