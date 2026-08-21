import { forwardRef, useState } from 'react'
import { Eye, EyeOff } from 'lucide-react'
import { cn } from '@/lib/utils'


const PasswordField = forwardRef(function PasswordField(
  { error, className, placeholder = 'Password', ...props },
  ref
) {
  const [visible, setVisible] = useState(false)

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
        <input
          ref={ref}
          type={visible ? 'text' : 'password'}
          maxLength={16}
          placeholder={placeholder}
          className="flex-1 bg-transparent py-2.5 text-sm outline-none min-h-[44px]"
          {...props}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          className="gs-focus-ring rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={17} aria-hidden="true" /> : <Eye size={17} aria-hidden="true" />}
        </button>
      </div>
      {error && (
        <span className="text-xs text-destructive" role="alert">
          {error}
        </span>
      )}
    </div>
  )
})

export default PasswordField