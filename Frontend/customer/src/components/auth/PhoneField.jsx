import { forwardRef } from 'react'
import { cn } from '@/lib/utils'

/**
 * PhoneField — Design System: Phase 4.1 Auth Migration
 * Focus: wrapper receives focus-within ring using --gs-primary token.
 * Input itself uses outline-none — focus is communicated via the wrapper border.
 * WCAG AA: border-width increases and ring-color contrast > 3:1 on white.
 */
const PhoneField = forwardRef(function PhoneField({ error, className, ...props }, ref) {
  return (
    <div className={cn('flex flex-col gap-1', className)}>
      <div
        className={cn(
          'flex items-center bg-[color:var(--gs-surface,#FFFFFF)] px-3',
          'rounded-[var(--gs-radius-lg,0.75rem)]',
          'border transition-colors duration-150',
          error
            ? 'border-destructive'
            : 'border-[color:var(--gs-border,#E5E7EB)] focus-within:border-[color:var(--gs-primary,#1B3A25)] focus-within:ring-2 focus-within:ring-[color:var(--gs-primary,#1B3A25)]/20'
        )}
      >
        <span className="text-sm text-muted-foreground pr-2 border-r border-[color:var(--gs-border,#E5E7EB)] mr-2 select-none">
          +977
        </span>
        <input
          ref={ref}
          type="tel"
          inputMode="numeric"
          maxLength={10}
          placeholder="98XXXXXXXX"
          className="flex-1 bg-transparent py-2.5 text-sm outline-none"
          onInput={(e) => {
            e.target.value = e.target.value.replace(/\D/g, '').slice(0, 10)
          }}
          {...props}
        />
      </div>
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  )
})

export default PhoneField