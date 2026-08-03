/**
 * Pagination — Admin Design System: Phase 5.1
 *
 * Replaces the repeated pagination nav pattern in:
 *   OrdersPage, ReviewsPage, UsersPage, SubscriptionsPage
 *
 * Usage:
 *   <Pagination
 *     page={page}
 *     totalPages={totalPages}
 *     total={data?.total}
 *     onPage={setPage}
 *     label="orders"            // used in aria-label
 *   />
 *
 * Accessibility:
 *   - <nav aria-label="X pagination"> (WCAG 2.4.1 A)
 *   - Previous/Next buttons: aria-label, disabled state (WCAG 4.1.2 A)
 *   - aria-current="page" on current page indicator (WCAG 4.1.2 A)
 *   - Buttons use gs-admin-focus-ring (WCAG 2.4.7 AA)
 *   - ChevronLeft/ChevronRight icons aria-hidden (WCAG 1.1.1 A)
 */

import { ChevronLeft, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'

export default function Pagination({
  page,
  totalPages,
  total,
  onPage,
  label = 'items',
}) {
  if (!totalPages || totalPages <= 1) return null

  return (
    <nav
      className="flex items-center justify-between px-4 py-3 border-t border-border"
      aria-label={`${label} pagination`}
    >
      <p className="text-xs text-muted-foreground" aria-live="polite" aria-atomic="true">
        Page {page} of {totalPages}
        {total != null && ` · ${total.toLocaleString()} total`}
      </p>
      <div className="flex gap-2">
        <Button
          variant="outline"
          size="sm"
          aria-label="Previous page"
          onClick={() => onPage((p) => Math.max(1, p - 1))}
          disabled={page === 1}
          className="gs-admin-focus-ring"
        >
          <ChevronLeft size={14} aria-hidden="true" />
        </Button>
        <Button
          variant="outline"
          size="sm"
          aria-label="Next page"
          onClick={() => onPage((p) => Math.min(totalPages, p + 1))}
          disabled={page === totalPages}
          className="gs-admin-focus-ring"
        >
          <ChevronRight size={14} aria-hidden="true" />
        </Button>
      </div>
    </nav>
  )
}
