import { useEffect, useState } from 'react'
import { Clock } from 'lucide-react'


function useCountdown(endHour) {
  const [label, setLabel] = useState('')

  useEffect(() => {
    const tick = () => {
      const now = new Date()
      const end = new Date(now)
      end.setHours(endHour, 0, 0, 0)
      if (end <= now) end.setDate(end.getDate() + 1)
      const diffMs = end - now
      const h = Math.floor(diffMs / 3600000)
      const m = Math.floor((diffMs % 3600000) / 60000)
      setLabel(`${h}h ${m}m left`)
    }
    tick()
    const id = setInterval(tick, 60_000)
    return () => clearInterval(id)
  }, [endHour])

  return label
}

export default function SpecialSessionBanner({ session }) {
  const countdown = useCountdown(session.endHour)

  return (
    <div
      className="mx-4 mt-4 rounded-[var(--gs-radius-xl,1rem)] px-4 py-3 flex items-center justify-between gap-3"
      style={{
        backgroundColor: 'var(--gs-primary, #1B3A25)',
        boxShadow: 'var(--gs-shadow-sm)',
      }}
    >
      <div>
        <p
          className="font-display text-base leading-tight"
          style={{ color: 'var(--gs-bg, #FAF8F5)' }}
        >
          {session.displayName}
        </p>
        {session.tagline && (
          <p
            className="text-xs mt-0.5"
            style={{ color: 'rgba(250, 248, 245, 0.8)' }}
          >
            {session.tagline}
          </p>
        )}
      </div>
      <div className="flex flex-col items-end shrink-0">
        <span
          className="font-mono font-semibold text-sm"
          style={{ color: 'var(--gs-secondary, #B58A63)' }}
        >
          -{session.discountPercent}%
        </span>
        <span
          className="flex items-center gap-1 text-[11px]"
          style={{ color: 'rgba(250, 248, 245, 0.7)' }}
        >
          <Clock size={11} aria-hidden="true" />
          {countdown}
        </span>
      </div>
    </div>
  )
}