import { useNavigate } from 'react-router-dom'
import { ChevronLeft } from 'lucide-react'


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