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

  const categoryName = isAll 
    ? 'All Items' 
    : categories?.find(c => c._id === categoryId)?.name || 'Category'

  const { data: searchResults, isLoading } = useQuery({
    queryKey: ['menu', 'category', categoryId],
    queryFn: () => menuApi.getMenu(isAll ? {} : { category: categoryId }).then((r) => r.data.items),
  })

  return (
    <div className="pb-8 bg-background min-h-dvh flex flex-col">
      <PageHeader title={categoryName} showBack={true} />

      <div className="flex-1 px-4 pt-5">
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
