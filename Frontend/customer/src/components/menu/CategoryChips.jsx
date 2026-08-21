import { cn } from '@/lib/utils'


export default function CategoryChips({ categories, activeId, onSelect }) {
  return (
    <div className="py-4 bg-muted/30" role="group" aria-label="Filter by category">
      <div
        className="flex gap-4 overflow-x-auto px-4 no-scrollbar"
        style={{ scrollbarWidth: 'none' }}
      >
        {/* All categories chip */}
        <button
          onClick={() => onSelect(null)}
          aria-pressed={activeId === null}
          aria-label="Show all categories"
          className="flex flex-col items-center gap-1.5 shrink-0 gs-focus-ring rounded-lg"
        >
          <div className={cn(
            'w-14 h-14 rounded-full flex items-center justify-center transition-all duration-300',
            activeId === null
              ? 'bg-secondary text-secondary-foreground shadow-md scale-105'
              : 'bg-card text-muted-foreground border border-border shadow-sm'
          )}>
            <span className="text-xl" aria-hidden="true">🍱</span>
          </div>
          <span className={cn(
            'text-xs font-medium transition-colors',
            activeId === null ? 'text-foreground font-semibold' : 'text-muted-foreground'
          )}>
            All
          </span>
        </button>

        {/* Per-category chips */}
        {categories.map((cat) => (
          <button
            key={cat._id}
            onClick={() => onSelect(cat._id)}
            aria-pressed={activeId === cat._id}
            aria-label={`Show ${cat.name} items`}
            className="flex flex-col items-center gap-1.5 shrink-0 group gs-focus-ring rounded-lg"
          >
            <div className={cn(
              'w-14 h-14 rounded-full overflow-hidden flex items-center justify-center transition-all duration-300 border-2',
              activeId === cat._id
                ? 'border-secondary shadow-md scale-105'
                : 'border-transparent bg-card shadow-sm group-hover:border-secondary/30'
            )}>
              {cat.image?.url ? (
                <img
                  src={cat.image.url}
                  alt={cat.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <span className="text-xl" aria-hidden="true">🍲</span>
              )}
            </div>
            <span className={cn(
              'text-xs font-medium transition-colors',
              activeId === cat._id ? 'text-foreground font-semibold' : 'text-muted-foreground'
            )}>
              {cat.name}
            </span>
          </button>
        ))}
      </div>
    </div>
  )
}