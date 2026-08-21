import { MapPin, Home, Briefcase, Star, Pencil, Trash2 } from 'lucide-react'
import { cn } from '@/lib/utils'

const LABEL_ICONS = { Home, Work: Briefcase, Other: MapPin }

export default function AddressCard({
  address,
  onEdit,
  onDelete,
  onSetDefault,
  selectable,
  selected,
  onSelect,
}) {
  const Icon = LABEL_ICONS[address.label] || MapPin
  const addressSummary = [address.street, address.area, address.city].filter(Boolean).join(', ')

  const cardContent = (
    <>
      {/* Icon avatar */}
      <div
        className="h-9 w-9 shrink-0 bg-muted flex items-center justify-center"
        style={{ borderRadius: 'var(--gs-radius-full, 9999px)' }}
        aria-hidden="true"
      >
        <Icon size={16} className="text-primary" aria-hidden="true" />
      </div>

      {/* Address text */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-medium text-foreground">{address.label}</span>
          {address.isDefault && (
            <span className="flex items-center gap-0.5 text-[10px] text-secondary font-medium">
              <Star size={10} className="fill-secondary" aria-hidden="true" />
              Default
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground truncate">{addressSummary}</p>
        {address.landmark && (
          <p className="text-xs text-muted-foreground truncate">Near {address.landmark}</p>
        )}
      </div>

      {/* Edit / delete actions */}
      {(onEdit || onDelete) && (
        <div className="flex flex-col gap-1 shrink-0 justify-center">
          {onEdit && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onEdit(address) }}
              aria-label={`Edit ${address.label} address`}
              className="h-11 w-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors gs-focus-ring rounded-[var(--gs-radius-md,0.5rem)]"
            >
              <Pencil size={15} aria-hidden="true" />
            </button>
          )}
          {onDelete && (
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); onDelete(address) }}
              aria-label={`Delete ${address.label} address`}
              className="h-11 w-11 flex items-center justify-center text-destructive hover:text-destructive/80 transition-colors gs-focus-ring rounded-[var(--gs-radius-md,0.5rem)]"
            >
              <Trash2 size={15} aria-hidden="true" />
            </button>
          )}
        </div>
      )}
    </>
  )

  const sharedClasses = cn(
    'flex gap-3 border bg-card p-3 text-left w-full',
    selected ? 'border-primary bg-primary/5' : 'border-border'
  )

  const sharedStyle = {
    borderRadius: 'var(--gs-radius-lg, 0.75rem)',
    boxShadow: selected ? 'var(--gs-shadow-sm)' : undefined,
  }

  // Selectable → accessible button element (WCAG 4.1.2)
  if (selectable) {
    return (
      <button
        type="button"
        onClick={() => onSelect?.(address)}
        aria-pressed={selected}
        aria-label={`Select ${address.label} address: ${addressSummary}`}
        className={cn(sharedClasses, 'cursor-pointer active:scale-[0.99] transition-transform gs-focus-ring')}
        style={sharedStyle}
      >
        {cardContent}
      </button>
    )
  }

  // Non-selectable → plain div (display only)
  return (
    <div className={sharedClasses} style={sharedStyle}>
      {cardContent}
    </div>
  )
}