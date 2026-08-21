import { useEffect, useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { settingsApi } from '@/api/orders'
import { cn } from '@/lib/utils'

const STORAGE_KEY = 'gs-popup-seen'


function popupId(popup) {
  return [popup.title, popup.message, popup.buttonText, popup.buttonLink, popup.validUntil]
    .join('|')
}

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function wasDismissedToday(id) {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return false
    const { id: seenId, date } = JSON.parse(raw)
    return seenId === id && date === todayStr()
  } catch {
    return false
  }
}

function markDismissed(id) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify({ id, date: todayStr() }))
  } catch {
    // localStorage unavailable — acceptable fallback
  }
}

export default function MarketingPopup() {
  const navigate = useNavigate()
  const [visible, setVisible] = useState(false)
  const [mounted, setMounted] = useState(false)

  const { data: settings } = useQuery({
    queryKey: ['settings', 'public'],
    queryFn: () => settingsApi.getPublic().then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  })

  const popup = settings?.popup?.enabled ? settings.popup : null

  const isExpired = useMemo(() => {
    if (!popup?.validUntil) return false
    return new Date(popup.validUntil).getTime() < Date.now()
  }, [popup?.validUntil])

  useEffect(() => {
    if (!popup || isExpired) return
    const id = popupId(popup)
    if (wasDismissedToday(id)) return
    const timer = setTimeout(() => {
      setMounted(true)
      requestAnimationFrame(() => setVisible(true))
    }, 700)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [popup?.title, popup?.message, popup?.buttonLink, popup?.validUntil, isExpired])

  const close = () => {
    if (popup) markDismissed(popupId(popup))
    setVisible(false)
    setTimeout(() => setMounted(false), 200)
  }

  const handleAction = () => {
    const link = popup?.buttonLink?.trim()
    close()
    if (!link) return
    if (link.startsWith('/')) {
      navigate(link)
    } else {
      window.open(link, '_blank', 'noopener,noreferrer')
    }
  }

  if (!mounted || !popup) return null

  return (
    <>
      {/* Backdrop */}
      <div
        className={cn(
          'fixed inset-0 bg-black/50 backdrop-blur-sm transition-opacity',
          visible ? 'opacity-100' : 'opacity-0'
        )}
        style={{
          zIndex: 'var(--gs-z-modal, 1300)',
          transitionDuration: 'var(--gs-motion-normal, 200ms)',
        }}
        onClick={close}
        aria-hidden="true"
      />

      {/* Popup card */}
      <div
        className={cn(
          'fixed inset-x-6 top-1/2 -translate-y-1/2 overflow-hidden transition-all',
          visible ? 'opacity-100 scale-100' : 'opacity-0 scale-95'
        )}
        style={{
          zIndex: 'var(--gs-z-modal, 1300)',
          borderRadius: 'var(--gs-radius-2xl, 1.5rem)',
          boxShadow: 'var(--gs-shadow-modal)',
          transitionDuration: 'var(--gs-motion-smooth, 300ms)',
        }}
        role="dialog"
        aria-modal="true"
        aria-label={popup.title || 'Promotion'}
      >
        <div
          className="relative p-5 pt-6 text-white"
          style={{ backgroundColor: popup.bgColor || '#f97316' }}
        >
          {/* Close button */}
          <button
            onClick={close}
            aria-label="Close promotion"
            className="absolute top-3 right-3 h-7 w-7 rounded-full bg-black/15 flex items-center justify-center hover:bg-black/25 transition-colors gs-focus-ring"
          >
            <X size={15} aria-hidden="true" />
          </button>

          {/* Promo image */}
          {popup.image?.url && (
            <div className="rounded-[var(--gs-radius-lg,0.75rem)] overflow-hidden mb-4 aspect-video bg-black/10">
              <img src={popup.image.url} alt="" className="h-full w-full object-cover" />
            </div>
          )}

          {popup.title && (
            <h3 className="font-display text-xl font-bold pr-6">{popup.title}</h3>
          )}
          {popup.message && (
            <p className="text-sm opacity-90 mt-1.5 leading-relaxed">{popup.message}</p>
          )}

          {/* CTA button */}
          <button
            onClick={handleAction}
            className="mt-4 w-full rounded-[var(--gs-radius-lg,0.75rem)] bg-white text-foreground py-3 text-sm font-bold active:scale-[0.98] transition-transform gs-focus-ring"
          >
            {popup.buttonText || 'Order Now'}
          </button>
        </div>
      </div>
    </>
  )
}