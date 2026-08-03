import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { useAuthStore } from '@/store/authStore'
import { useNotificationStore } from '@/store/notificationStore'
import { getSocket, disconnectSocket } from '@/lib/socket'
import { playNotificationSound } from '@/lib/notificationSound'

/**
 * Connects to the admin Socket.IO room and turns `order:new` / `order:updated`
 * events into: a toast + chime, a sidebar badge count, and live query refreshes.
 * Mount this once, high up the tree (AdminLayout), while the admin is logged in.
 */
export function useOrderNotifications() {
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated)
  const accessToken = useAuthStore((s) => s.accessToken)
  const queryClient = useQueryClient()
  const navigate = useNavigate()
  const incrementUnread = useNotificationStore((s) => s.incrementUnread)

  useEffect(() => {
    if (!isAuthenticated || !accessToken) {
      disconnectSocket()
      return
    }

    const socket = getSocket()

    const handleConnect = () => {
      socket.emit('join:admin')
    }

    const handleNewOrder = (order) => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })

      incrementUnread()
      if (useNotificationStore.getState().soundEnabled) playNotificationSound()

      const customerName = order.customer?.name || order.guestInfo?.name || 'Guest'
      const amount = typeof order.totalAmount === 'number' ? order.totalAmount.toLocaleString() : order.totalAmount

      toast.success(`New order #${order.orderNumber || ''}`, {
        description: `${customerName} · Rs. ${amount}`,
        duration: 10000,
        action: {
          label: 'View order',
          onClick: () => navigate(`/orders/${order._id}`),
        },
      })
    }

    const handleOrderUpdated = () => {
      queryClient.invalidateQueries({ queryKey: ['orders'] })
      queryClient.invalidateQueries({ queryKey: ['stats'] })
      queryClient.invalidateQueries({ queryKey: ['order'] })
    }

    socket.on('connect', handleConnect)
    socket.on('order:new', handleNewOrder)
    socket.on('order:updated', handleOrderUpdated)

    if (socket.connected) handleConnect()
    else socket.connect()

    return () => {
      socket.off('connect', handleConnect)
      socket.off('order:new', handleNewOrder)
      socket.off('order:updated', handleOrderUpdated)
    }
  }, [isAuthenticated, accessToken, queryClient, navigate, incrementUnread])
}
