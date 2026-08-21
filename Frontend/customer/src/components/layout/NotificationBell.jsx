import { useState, useRef, useEffect } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { formatDistanceToNow } from 'date-fns'
import { Bell as BellIcon, Check } from 'lucide-react'
import { notificationsApi } from '@/api/notifications'

export default function NotificationBell() {
  const [open, setOpen] = useState(false)
  const panelRef = useRef(null)
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const { data } = useQuery({
    queryKey: ['notifications'],
    queryFn: () => notificationsApi.list().then((r) => r.data.notifications || []),
    refetchInterval: 60000,
  })
  const notifications = data || []
  const unreadCount = notifications.filter((n) => !n.isRead).length

  useEffect(() => {
    if (!open) return
    const onClick = (e) => {
      if (panelRef.current && !panelRef.current.contains(e.target)) setOpen(false)
    }
    document.addEventListener('mousedown', onClick)
    return () => document.removeEventListener('mousedown', onClick)
  }, [open])

  const handleItemClick = (n) => {
    if (!n.isRead) {
      queryClient.setQueryData(['notifications'], (prev) =>
        (prev || []).map((x) => (x._id === n._id ? { ...x, isRead: true } : x))
      )
      notificationsApi.markRead(n._id).catch(() => {})
    }
    
    if (n.data?.orderId) {
      navigate(`/track/${n.data.orderId}`)
      setOpen(false)
    } else if (n.data?.type === 'abandoned_cart') {
      navigate('/cart')
      setOpen(false)
    } else if (n.type === 'promo') {
      navigate('/')
      setOpen(false)
    }
  }

  const handleMarkAllRead = () => {
    queryClient.setQueryData(['notifications'], (prev) => (prev || []).map((x) => ({ ...x, isRead: true })))
    notificationsApi.markAllRead().catch(() => {})
  }

  return (
    <div className="relative shrink-0" ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label={unreadCount > 0 ? `Notifications — ${unreadCount} unread` : 'Notifications'}
        aria-expanded={open}
        className="relative flex h-9 w-9 items-center justify-center rounded-full gs-focus-ring"
        style={{ color: 'var(--gs-bg, #FAF8F5)' }}
      >
        <BellIcon size={18} aria-hidden="true" />
        {unreadCount > 0 && (
          <span
            className="absolute top-1 right-1 min-w-[16px] h-4 px-1 rounded-full bg-red-500 text-white text-[10px] font-bold flex items-center justify-center"
            aria-hidden="true"
          >
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          aria-label="Notifications"
          className="absolute right-0 mt-2 w-80 max-h-96 overflow-y-auto bg-card border border-border shadow-lg text-left"
          style={{ borderRadius: 'var(--gs-radius-lg, 0.75rem)', zIndex: 'var(--gs-z-modal, 1300)' }}
        >
          <div className="flex items-center justify-between px-4 py-3 border-b border-border sticky top-0 bg-card">
            <span className="font-display font-semibold text-sm text-foreground">Notifications</span>
            {unreadCount > 0 && (
              <button
                onClick={handleMarkAllRead}
                className="text-xs font-semibold text-primary hover:underline flex items-center gap-1"
              >
                <Check size={12} aria-hidden="true" />
                Mark all read
              </button>
            )}
          </div>

          {notifications.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-8 px-4">No notifications yet.</p>
          ) : (
            <ul>
              {notifications.map((n) => (
                <li key={n._id}>
                  <button
                    onClick={() => handleItemClick(n)}
                    className={`w-full text-left px-4 py-3 border-b border-border last:border-0 hover:bg-muted/50 transition-colors flex gap-2.5 ${
                      !n.isRead ? 'bg-primary/5' : ''
                    }`}
                  >
                    <span
                      className={`mt-1.5 h-2 w-2 rounded-full shrink-0 ${!n.isRead ? 'bg-primary' : 'bg-transparent'}`}
                      aria-hidden="true"
                    />
                    <span className="min-w-0">
                      <span className="block text-sm font-medium text-foreground truncate">{n.title}</span>
                      <span className="block text-xs text-muted-foreground mt-0.5 line-clamp-2">{n.body}</span>
                      <span className="block text-[11px] text-muted-foreground/70 mt-1">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </div>
  )
}