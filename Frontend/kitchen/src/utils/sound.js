let audioCtx = null

function unlockAudio() {
  if (audioCtx && audioCtx.state === 'suspended') {
    audioCtx.resume().catch(() => {})
  }
}

if (typeof window !== 'undefined') {
  window.addEventListener('pointerdown', unlockAudio, { passive: true })
  window.addEventListener('keydown', unlockAudio, { passive: true })
}

function getContext() {
  const AudioCtx = window.AudioContext || window.webkitAudioContext
  if (!AudioCtx) return null
  if (!audioCtx) audioCtx = new AudioCtx()
  if (audioCtx.state === 'suspended') audioCtx.resume().catch(() => {})
  return audioCtx
}

/**
 * Plays a short two-tone chime to announce a new order.
 * Identical to the admin panel sound — generated with Web Audio API,
 * no sound file needed.
 */
export function playNotificationSound() {
  try {
    const ctx = getContext()
    if (!ctx) return
    const now = ctx.currentTime

    const playTone = (freq, start, duration) => {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.type = 'sine'
      osc.frequency.value = freq
      gain.gain.setValueAtTime(0, now + start)
      gain.gain.linearRampToValueAtTime(0.28, now + start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, now + start + duration)
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.start(now + start)
      osc.stop(now + start + duration + 0.05)
    }

    playTone(880, 0, 0.16)
    playTone(1175, 0.14, 0.22)
  } catch {
    // Sound is a nice-to-have — never let it break the notification flow.
  }
}
