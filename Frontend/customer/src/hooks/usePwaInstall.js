import { useEffect, useState, useCallback } from 'react'

/** Captures the browser's install prompt so we can trigger it from our own
 *  CTA button instead of waiting for the OS's default mini-infobar. Returns
 *  null on iOS Safari (no beforeinstallprompt support) — callers should
 *  show "Add to Home Screen" instructions there instead. */
export function usePwaInstall() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [isInstalled, setIsInstalled] = useState(
    () => window.matchMedia('(display-mode: standalone)').matches
  )

  useEffect(() => {
    const handler = (e) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)

    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const promptInstall = useCallback(async () => {
    if (!deferredPrompt) return null
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    setDeferredPrompt(null)
    if (outcome === 'accepted') setIsInstalled(true)
    return outcome
  }, [deferredPrompt])

  return { canInstall: !!deferredPrompt, isInstalled, promptInstall }
}