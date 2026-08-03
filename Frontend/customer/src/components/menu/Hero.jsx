import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, Download, Check } from 'lucide-react'
import { usePwaInstall } from '@/hooks/usePwaInstall'

/**
 * Hero — Design System: Phase 4.2 Customer Home Migration
 *
 * Design tokens applied:
 *   --gs-primary       Forest Green background
 *   --gs-secondary     Faded Copper accent / search ring
 *   --gs-bg            Warm Ivory search bar background
 *   --gs-border        Search bar border
 *   --gs-text-sub      Search placeholder / muted text
 *   --gs-shadow-md     Search bar elevation
 *   --gs-radius-full   Search bar pill shape
 *   --gs-motion-normal Transition speed
 *
 * No business logic or search/install behavior changed.
 */
export default function Hero() {
  const [query, setQuery] = useState('')
  const navigate = useNavigate()
  const { canInstall, isInstalled, promptInstall } = usePwaInstall()

  const handleSearch = (e) => {
    e.preventDefault()
    navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : '/')
  }

  return (
    <section
      className="relative overflow-hidden px-5 pt-10 pb-8 rounded-b-4xl mb-2"
      style={{
        backgroundColor: 'var(--gs-primary, #1B3A25)',
        boxShadow: 'var(--gs-shadow-sm)',
      }}
    >
      {/* Decorative ambient blob — Faded Copper glow, no motion */}
      <div
        className="absolute top-0 right-0 -mr-16 -mt-16 w-64 h-64 rounded-full blur-3xl pointer-events-none"
        style={{ backgroundColor: 'var(--gs-secondary, #B58A63)', opacity: 0.12 }}
        aria-hidden="true"
      />

      <div className="relative z-10">
        <h1
          className="font-display text-3xl font-bold leading-tight max-w-70"
          style={{ color: 'var(--gs-bg, #FAF8F5)' }}
        >
          Ghar ko Swad,<br />
        </h1>

        {/* Search bar */}
        <form
          onSubmit={handleSearch}
          className="mt-6 flex items-center gap-3 rounded-full px-4 py-3.5 transition-all"
          style={{
            backgroundColor: 'var(--gs-bg, #FAF8F5)',
            border: '1px solid var(--gs-border, #E5E7EB)',
            boxShadow: 'var(--gs-shadow-md)',
          }}
          role="search"
        >
          <Search
            size={20}
            className="shrink-0"
            style={{ color: 'var(--gs-text-sub, #6B7280)' }}
            aria-hidden="true"
          />
          <input
            name="search"
            id="menu-search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Search for momo, thali..."
            aria-label="Search menu items"
            className="flex-1 bg-transparent outline-none text-[15px] text-foreground placeholder:text-muted-foreground"
          />
          <button
            type="submit"
            className="text-sm font-bold shrink-0 uppercase tracking-wide gs-focus-ring rounded-full"
            style={{ color: 'var(--gs-secondary, #B58A63)' }}
          >
            Search
          </button>
        </form>

        {/* PWA install prompt */}
        {!isInstalled && (
          <button
            onClick={canInstall ? promptInstall : undefined}
            className="mt-5 flex items-center gap-2 text-xs font-medium transition-colors rounded-full px-4 py-2 w-max backdrop-blur-sm gs-focus-ring"
            style={{
              color: 'var(--gs-bg, #FAF8F5)',
              backgroundColor: 'rgba(250, 248, 245, 0.1)',
              border: '1px solid rgba(250, 248, 245, 0.2)',
              transitionDuration: 'var(--gs-motion-fast, 150ms)',
            }}
            aria-label={canInstall ? 'Install Gharko Swaad app' : 'App works in your browser'}
          >
            {canInstall ? (
              <>
                <Download
                  size={14}
                  style={{ color: 'var(--gs-secondary, #B58A63)' }}
                  aria-hidden="true"
                />
                Install the App
              </>
            ) : (
              <>
                <Check size={14} className="text-accent" aria-hidden="true" />
                Works right in your browser
              </>
            )}
          </button>
        )}
      </div>
    </section>
  )
}