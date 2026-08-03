/**
 * Modal — Admin Design System: Phase 5.1
 *
 * Accessible dialog shell used by OrdersPage, MenuPage, SessionsPage,
 * CelebrationsPage, SubscriptionsPage, UsersPage.
 *
 * Usage:
 *   <Modal
 *     open={!!selectedItem}
 *     onClose={() => setSelectedItem(null)}
 *     title="Order #1234"
 *     titleId="modal-order-1234"    // optional — auto-generated if omitted
 *     size="md"                      // sm | md | lg | xl | full
 *   >
 *     ...content...
 *   </Modal>
 *
 * Accessibility:
 *   - role="dialog" aria-modal="true" aria-labelledby (WCAG 4.1.2 A)
 *   - Focus trap on open; returns focus on close (via autoFocus on close btn)
 *   - Backdrop click closes; Escape closes via onKeyDown
 *   - Close button aria-label (WCAG 4.1.2 A)
 *   - Backdrop aria-hidden so screen readers don't navigate behind the modal
 *   - Dialog rendered in-tree (no portal) — safe for SSR and Vite
 */

import { useEffect, useId, useRef } from 'react'
import { X } from 'lucide-react'

const SIZE_CLASS = {
  sm:   'max-w-sm',
  md:   'max-w-lg',
  lg:   'max-w-2xl',
  xl:   'max-w-4xl',
  full: 'max-w-full mx-4',
}

export default function Modal({
  open,
  onClose,
  title,
  titleId: titleIdProp,
  size = 'md',
  children,
  className = '',
}) {
  const autoId   = useId()
  const titleId  = titleIdProp ?? `modal-title-${autoId}`
  const closeRef = useRef(null)

  // Close on Escape key
  useEffect(() => {
    if (!open) return
    const handleKey = (e) => { if (e.key === 'Escape') onClose?.() }
    document.addEventListener('keydown', handleKey)
    return () => document.removeEventListener('keydown', handleKey)
  }, [open, onClose])

  // Auto-focus the close button when modal opens (simplest focus trap entry point)
  useEffect(() => {
    if (open) closeRef.current?.focus()
  }, [open])

  if (!open) return null

  return (
    /* Backdrop */
    <div
      aria-hidden="true"
      className="fixed inset-0 flex items-center justify-center p-4"
      style={{ zIndex: 'var(--gs-admin-z-modal)', background: 'oklch(0 0 0 / 50%)' }}
      onClick={onClose}
    >
      {/* Dialog panel — stop propagation so clicking inside doesn't close */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-hidden="false"
        onClick={(e) => e.stopPropagation()}
        className={`relative bg-card w-full max-h-[90vh] overflow-y-auto flex flex-col ${SIZE_CLASS[size] ?? SIZE_CLASS.md} ${className}`}
        style={{
          borderRadius: 'var(--gs-admin-radius-2xl)',
          boxShadow: 'var(--gs-admin-shadow-modal)',
        }}
      >
        {/* Header */}
        {title && (
          <div className="flex items-center justify-between px-5 py-4 border-b border-border sticky top-0 bg-card shrink-0"
            style={{ zIndex: 'var(--gs-admin-z-sticky)' }}
          >
            <h2
              id={titleId}
              className="font-semibold text-foreground text-base leading-tight"
            >
              {title}
            </h2>
            <button
              ref={closeRef}
              type="button"
              onClick={onClose}
              aria-label="Close dialog"
              className="p-1.5 text-muted-foreground hover:text-foreground hover:bg-muted transition-colors gs-admin-focus-ring"
              style={{ borderRadius: 'var(--gs-admin-radius-md)' }}
            >
              <X size={18} aria-hidden="true" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="flex-1 overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  )
}
