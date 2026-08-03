import { useQuery } from '@tanstack/react-query'
import { useNavigate } from 'react-router-dom'
import { menuApi } from '@/api/menu'
import PageHeader from '@/components/layout/PageHeader'
import { ChevronRight } from 'lucide-react'

export default function Categories() {
  const navigate = useNavigate()

  const { data: categories, isLoading } = useQuery({
    queryKey: ['categories'],
    queryFn: () => menuApi.getCategories().then((r) => r.data.categories || r.data),
  })

  const handleCategoryClick = (categoryId) => {
    navigate(`/category/${categoryId}`)
  }

  const allItemsCategory = { _id: 'all', name: 'All Items', image: null }
  const displayCategories = categories ? [allItemsCategory, ...categories] : []

  return (
    <div className="min-h-dvh flex flex-col bg-background">
      <PageHeader title="Categories" showBack={false} />

      <div className="flex-1 px-4 py-4">
        {isLoading ? (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-square rounded-xl bg-muted animate-pulse" />
            ))}
          </div>
        ) : displayCategories.length > 0 ? (
          <div className="grid grid-cols-2 gap-3">
            {displayCategories.map((category) => (
              <button
                key={category._id}
                onClick={() => handleCategoryClick(category._id)}
                className="relative aspect-square overflow-hidden rounded-xl border border-border bg-card group text-left shadow-sm hover:border-primary/50 transition-colors"
              >
                {category.image?.url ? (
                  <img
                    src={category.image.url}
                    alt={category.name}
                    className="absolute inset-0 h-full w-full object-cover group-hover:scale-105 transition-transform duration-300"
                  />
                ) : (
                  <div className="absolute inset-0 bg-secondary/20 flex items-center justify-center">
                    <span className="text-4xl">🍲</span>
                  </div>
                )}
                <div className="absolute inset-0 bg-linear-to-t from-black/80 via-black/20 to-transparent" />
                <div className="absolute bottom-0 left-0 right-0 p-3 flex items-center justify-between">
                  <h3 className="font-display font-medium text-white line-clamp-1">{category.name}</h3>
                  <ChevronRight size={16} className="text-white/70" />
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="flex items-center justify-center h-48 text-muted-foreground text-sm">
            No categories found.
          </div>
        )}
      </div>
    </div>
  )
}
