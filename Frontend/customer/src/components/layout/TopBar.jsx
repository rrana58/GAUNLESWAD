import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Search, UserRound } from 'lucide-react'
import { useAuthStore } from '@/store/authStore'
import NotificationBell from './NotificationBell'


export default function TopBar() {
  const navigate = useNavigate()
  const { user, isAuthenticated } = useAuthStore()
  const [query, setQuery] = useState('')

  const handleSearch = (e) => {
    e.preventDefault()
    navigate(query.trim() ? `/?q=${encodeURIComponent(query.trim())}` : '/')
  }

  return (
    <header
      className="sticky top-0 z-20 flex items-center gap-2.5 px-4 py-2.5 select-none"
      style={{
        backgroundColor: 'var(--gs-primary, #1B3A25)',
        paddingTop: 'calc(env(safe-area-inset-top) + 0.625rem)',
      }}
    >
      {/* Brand logo button */}
      <button
        onClick={() => navigate('/')}
        aria-label="Gharko Swaad home"
        className="shrink-0 gs-focus-ring rounded-full"
      >
        <img src="/logo-source.png" alt="" className="h-8 w-8 rounded-full object-cover" aria-hidden="true" />
      </button>

      {/* Search bar — Warm Ivory surface on Forest Green */}
      <form
        onSubmit={handleSearch}
        className="flex-1 flex items-center gap-2 rounded-full px-3.5 py-2 min-w-0"
        style={{ backgroundColor: 'var(--gs-bg, #FAF8F5)' }}
        role="search"
      >
        <Search
          size={16}
          className="shrink-0"
          style={{ color: 'var(--gs-text-sub, #6B7280)' }}
          aria-hidden="true"
        />
        <input
          name="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search for momo, thali..."
          aria-label="Search menu items"
          className="flex-1 min-w-0 bg-transparent outline-none text-sm text-foreground placeholder:text-muted-foreground"
        />
      </form>

      {/* Notifications — only meaningful once logged in */}
      {isAuthenticated && <NotificationBell />}

      {/* Profile avatar */}
      <button
        onClick={() => navigate('/profile')}
        aria-label="Your profile"
        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full overflow-hidden gs-focus-ring"
        style={{
          backgroundColor: 'rgba(250, 248, 245, 0.15)',
          border: '1px solid rgba(250, 248, 245, 0.25)',
          color: 'var(--gs-bg, #FAF8F5)',
        }}
      >
        {user?.name ? (
          <span className="text-xs font-bold">{user.name[0].toUpperCase()}</span>
        ) : (
          <UserRound size={16} aria-hidden="true" />
        )}
      </button>
    </header>
  )
}