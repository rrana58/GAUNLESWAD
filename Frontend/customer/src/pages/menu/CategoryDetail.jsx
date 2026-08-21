import { useParams } from 'react-router-dom'
import { useQuery } from '@tanstack/react-query'
import { menuApi } from '@/api/menu'
import PageHeader from '@/components/layout/PageHeader'
import MenuItemCard from '@/components/menu/MenuItemCard'

export default function CategoryDetail() {
  const { categoryId } = useParams()
  const isAll = categoryId === 'all'

  // Fetch category details if not "all"
  const { data: categories } = useQuery({
    queryKey: ['categories'],
    queryFn: () => menuApi.getCategories().then((r) => r.data.categories || r.data),
    enabled: !isAll,
  })

  const currentCategory = !isAll ? categories?.find(c => c._id === categoryId) : null
  const categoryName = isAll ? 'All Items' : currentCategory?.name || 'Category'
  const categoryDescription = currentCategory?.description || ''

  // Helper to render bold formatting (*text* or **text**)
  const renderFormattedDescription = (text) => {
    if (!text) return null
    // Replace **bold** or *bold* with <strong>
    const parts = text.split(/(\*\*.*?\*\*|\*.*?\*)/g)
    return parts.map((part, i) => {
      if ((part.startsWith('**') && part.endsWith('**')) || (part.startsWith('*') && part.endsWith('*'))) {
        const cleanText = part.replace(/^\*+|\*+$/g, '')
        return <strong key={i} className="font-bold text-foreground">{cleanText}</strong>
      }
      return part
    })
  }

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['menu', 'category', categoryId],
    queryFn: () => menuApi.getMenu(isAll ? {} : { category: categoryId }).then((r) => r.data.items),
  })

  return (
    <div className="pb-8 bg-background min-h-dvh flex flex-col">
      <PageHeader title={categoryName} showBack={true} />

      <div className="flex-1 px-4 pt-3">
        {categoryDescription && (
          <p className="text-sm text-muted-foreground mb-4 leading-relaxed bg-muted/50 p-3 rounded-lg border border-border">
            {renderFormattedDescription(categoryDescription)}
          </p>
        )}
        {isLoading && (
          <div className="grid grid-cols-2 gap-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <div key={i} className="aspect-4/3 rounded-lg bg-muted animate-pulse" />
            ))}
          </div>
        )}

        {!isLoading && searchResults?.length === 0 && (
          <div className="flex items-center justify-center h-48 text-sm text-muted-foreground">
            No dishes found in this category.
          </div>
        )}

        {!isLoading && searchResults?.length > 0 && (
          <div className="grid grid-cols-2 gap-3">
            {searchResults.map((item) => (
              <MenuItemCard key={item._id} item={item} />
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
