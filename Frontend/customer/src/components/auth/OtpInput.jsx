import { useRef } from 'react'


export default function OtpInput({ value, onChange, error }) {
  const inputsRef = useRef([])
  const digits = value.split('').concat(Array(6).fill('')).slice(0, 6)

  const setDigit = (index, digit) => {
    const next = [...digits]
    next[index] = digit
    onChange(next.join(''))
  }

  const handleChange = (index, e) => {
    const raw = e.target.value.replace(/\D/g, '')
    if (!raw) {
      setDigit(index, '')
      return
    }
    // Handles single-digit typing and multi-digit paste landing in one box
    const chars = raw.split('')
    const next = [...digits]
    chars.forEach((c, i) => {
      if (index + i < 6) next[index + i] = c
    })
    onChange(next.join(''))
    const lastFilled = Math.min(index + chars.length, 5)
    inputsRef.current[lastFilled]?.focus()
  }

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputsRef.current[index - 1]?.focus()
    }
  }

  return (
    <div className="flex flex-col gap-1.5" role="group" aria-label="One-time password">
      <div className="flex gap-2 justify-between">
        {digits.map((d, i) => (
          <input
            key={i}
            ref={(el) => (inputsRef.current[i] = el)}
            value={d}
            onChange={(e) => handleChange(i, e)}
            onKeyDown={(e) => handleKeyDown(i, e)}
            inputMode="numeric"
            maxLength={6}
            aria-label={`Digit ${i + 1} of 6`}
            className={[
              'h-12 w-11 text-center text-lg font-mono',
              'rounded-[var(--gs-radius-lg,0.75rem)]',
              'border bg-[color:var(--gs-surface,#FFFFFF)]',
              'text-[color:var(--gs-text-main,#1F2937)]',
              'outline-none transition-colors duration-150',
              'focus-visible:ring-2 focus-visible:ring-[color:var(--gs-primary,#1B3A25)] focus-visible:ring-offset-1',
              error
                ? 'border-destructive'
                : 'border-[color:var(--gs-border,#E5E7EB)] focus-visible:border-[color:var(--gs-primary,#1B3A25)]',
            ].join(' ')}
          />
        ))}
      </div>
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  )
}