import { useEffect, useRef } from 'react'
import { useNavigate, useLocation } from 'react-router-dom'

export function useSwipeBack() {
  const navigate = useNavigate()
  const location = useLocation()
  const touchStartX = useRef(0)
  const touchStartY = useRef(0)

  useEffect(() => {
    // Disable gesture detection on the home/landing screen
    if (location.pathname === '/') return

    const handleTouchStart = (e) => {
      const startX = e.touches[0].clientX
      const startY = e.touches[0].clientY
      
      // Strict trigger: Touch must start within 40px of the left edge
      if (startX < 40) {
        touchStartX.current = startX
        touchStartY.current = startY
      } else {
        touchStartX.current = 0
        touchStartY.current = 0
      }
    }

    const handleTouchEnd = (e) => {
      if (touchStartX.current === 0) return

      const endX = e.changedTouches[0].clientX
      const endY = e.changedTouches[0].clientY

      const diffX = endX - touchStartX.current
      const diffY = Math.abs(endY - touchStartY.current)

      // Swipe requirements (Production calibrated):
      // Swipe distance > 80px, minimal vertical drift (< 40px)
      if (diffX > 80 && diffY < 40) {
        navigate(-1)
      }
    }

    window.addEventListener('touchstart', handleTouchStart, { passive: true })
    window.addEventListener('touchend', handleTouchEnd, { passive: true })

    return () => {
      window.removeEventListener('touchstart', handleTouchStart)
      window.removeEventListener('touchend', handleTouchEnd)
    }
  }, [navigate, location.pathname])
}