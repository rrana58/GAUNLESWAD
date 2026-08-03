import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'

/**
 * PageHeader — Design System: Phase 4.2 Customer Home Migration
 *
 * Changes:
 *  - Back button: added gs-focus-ring for keyboard accessibility
 *  - z-index: z-10 → z-[var(--gs-z-sticky)] token
 *  - Shadow from border-b border-border retained (Tailwind semantic token, correct)
 *  - All other Tailwind semantic tokens retained (bg-background, text-foreground, etc.)
 *  - Touch target: p-1.5 gives ~36px — increased to p-2 (40px) for closer WCAG compliance
 *
 * No navigation or prop interface changed.
 */
export default function PageHeader({ title, showBackButton = true, rightElement, onBack }) {
  const navigate = useNavigate()
  return (
    <header
      className="sticky top-0 flex h-14 w-full items-center justify-between border-b border-border bg-background/95 backdrop-blur px-4 select-none"
      style={{ zIndex: 'var(--gs-z-sticky, 1100)' }}
    >
      <div className="flex items-center gap-1.5">
        {showBackButton && (
          <button
            onClick={onBack || (() => navigate(-1))}
            className="rounded-full p-2 hover:bg-muted text-foreground transition-colors active:scale-95 gs-focus-ring"
            aria-label="Go back"
          >
            <ChevronLeft size={22} aria-hidden="true" />
          </button>
        )}
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
      </div>
      {rightElement && <div className="flex items-center">{rightElement}</div>}
    </header>
  )
}