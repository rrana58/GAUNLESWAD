import { cn } from '@/lib/utils'

/** Temporary stand-in used until each page's real phase is built. Keeps the
 *  app fully navigable from Phase 1 onward. */
export default function PagePlaceholder({ title, subtitle, className }) {
  return (
    <div className={cn('flex flex-col items-center justify-center text-center px-8 py-24 gap-2', className)}>
      <h1 className="font-display text-2xl text-primary">{title}</h1>
      {subtitle && <p className="text-muted-foreground text-sm max-w-xs">{subtitle}</p>}
    </div>
  )
}