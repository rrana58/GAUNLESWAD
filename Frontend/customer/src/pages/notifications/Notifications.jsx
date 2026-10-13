import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, CheckCheck, ChevronRight } from 'lucide-react'
import { toast } from 'sonner'
import PageHeader from '@/components/layout/PageHeader'
import { notificationsApi } from '@/api/notifications'
import { cn } from '@/lib/utils'

export default function Notifications() {
  const navigate = useNavigate()
  const queryClient = useQueryClient()

  const {
    data: notifications = [],
    isLoading,
    isError,
  } = useQuery({
    queryKey: ['notifications'],
    queryFn: async () => {
      const { data } = await notificationsApi.list()
      return data?.notifications || data?.data || []
    },
  })

  const unreadCount = useMemo(
    () => notifications.filter((notification) => !notification.isRead).length,
    [notifications]
  )

  const handleNotificationClick = async (notification) => {
    if (!notification.isRead) {
      queryClient.setQueryData(['notifications'], (current) =>
        (current || []).map((item) =>
          item._id === notification._id
            ? { ...item, isRead: true }
            : item
        )
      )

      try {
        await notificationsApi.markRead(notification._id)
      } catch {
        queryClient.invalidateQueries({ queryKey: ['notifications'] })
      }
    }

    if (notification.data?.announcementId) {
      navigate('/more?view=announcements')
    } else if (notification.data?.orderId) {
      navigate(`/track/${notification.data.orderId}`)
    } else if (notification.data?.type === 'abandoned_cart') {
      navigate('/cart')
    } else if (notification.data?.type === 'career_job' || notification.data?.type === 'career_application_status') {
    navigate('/more?view=jobs')
  } else if (notification.type === 'promo') {
      navigate('/more?view=promos')
    }
  }

  const handleMarkAllRead = async () => {
    if (!unreadCount) return

    try {
      await notificationsApi.markAllRead()

      queryClient.setQueryData(['notifications'], (current) =>
        (current || []).map((notification) => ({
          ...notification,
          isRead: true,
        }))
      )

      toast.success('All notifications marked as read')
    } catch {
      toast.error('Unable to mark notifications as read')
      queryClient.invalidateQueries({ queryKey: ['notifications'] })
    }
  }

  return (
    <div className="min-h-dvh flex flex-col">
      <PageHeader
        title="Notifications"
        showBackButton
        onBack={() => navigate(-1)}
        rightElement={
          unreadCount > 0 ? (
            <button
              type="button"
              onClick={handleMarkAllRead}
              className="flex items-center gap-1 text-sm font-medium text-primary gs-focus-ring"
              aria-label="Mark all notifications as read"
            >
              <CheckCheck size={17} aria-hidden="true" />
              <span>Read all</span>
            </button>
          ) : null
        }
      />

      <main className="flex-1 px-4 py-4" aria-label="Notifications">
        {isLoading && (
          <div className="flex flex-col gap-3" aria-label="Loading notifications">
            {[1, 2, 3].map((item) => (
              <div
                key={item}
                className="h-20 animate-pulse bg-muted rounded-xl"
              />
            ))}
          </div>
        )}

        {isError && !isLoading && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={36} className="text-muted-foreground mb-3" aria-hidden="true" />
            <p className="font-medium text-foreground">
              Unable to load notifications
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              Please try again.
            </p>
          </div>
        )}

        {!isLoading && !isError && notifications.length === 0 && (
          <div className="flex flex-col items-center justify-center py-16 text-center">
            <Bell size={40} className="text-muted-foreground mb-3" aria-hidden="true" />
            <p className="font-medium text-foreground">
              No notifications yet
            </p>
            <p className="text-sm text-muted-foreground mt-1">
              We'll let you know when something important happens.
            </p>
          </div>
        )}

        {!isLoading && !isError && notifications.length > 0 && (
          <ul className="flex flex-col gap-2" aria-label="Notification list">
            {notifications.map((notification) => (
              <li key={notification._id}>
                <button
                  type="button"
                  onClick={() => handleNotificationClick(notification)}
                  className={cn(
                    'w-full flex items-start gap-3 p-4 text-left border border-border transition-colors gs-focus-ring',
                    notification.isRead
                      ? 'bg-card'
                      : 'bg-primary/5 border-primary/20'
                  )}
                  style={{
                    borderRadius: 'var(--gs-radius-lg, 0.75rem)',
                  }}
                >
                  <span
                    className={cn(
                      'mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full',
                      notification.isRead ? 'bg-transparent' : 'bg-primary'
                    )}
                    aria-hidden="true"
                  />

                  <span className="min-w-0 flex-1">
                    <span className="block font-medium text-foreground">
                      {notification.title}
                    </span>

                    <span className="block mt-1 text-sm text-muted-foreground">
                      {notification.body}
                    </span>

                    <span className="block mt-2 text-xs text-muted-foreground">
                      {formatNotificationDate(notification.createdAt)}
                    </span>
                  </span>

                  <ChevronRight
                    size={18}
                    className="mt-1 shrink-0 text-muted-foreground"
                    aria-hidden="true"
                  />
                </button>
              </li>
            ))}
          </ul>
        )}
      </main>
    </div>
  )
}

function formatNotificationDate(value) {
  if (!value) return ''

  const date = new Date(value)

  if (Number.isNaN(date.getTime())) return ''

  return date.toLocaleString([], {
    dateStyle: 'medium',
    timeStyle: 'short',
  })
}
