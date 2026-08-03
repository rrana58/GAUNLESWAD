import { useMemo, useRef, useEffect } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useSearchParams, useLocation, Link, useNavigate } from 'react-router-dom'
import { menuApi } from '@/api/menu'
import { specialSessionApi, subscriptionApi } from '@/api/orders'
import SpecialSessionBanner from '@/components/menu/SpecialSessionBanner'
import CategoryChips from '@/components/menu/CategoryChips'
import MenuItemCard from '@/components/menu/MenuItemCard'
import PlanCard from '@/components/subscriptions/PlanCard'

export default function Home() {
  const [searchParams] = useSearchParams()
  const searchQuery = searchParams.get('q') || ''
  const location = useLocation()
  const navigate = useNavigate()
  const sectionRefs = useRef({})

  const { data: groupedData, isLoading: isMenuLoading } = useQuery({
    queryKey: ['menu', 'grouped'],
    queryFn: () => menuApi.getGrouped().then((r) => r.data.menu),
    enabled: !searchQuery,
  })

  const { data: searchResults, isLoading: isSearchLoading } = useQuery({
    queryKey: ['menu', 'search', searchQuery],
    queryFn: () => menuApi.getMenu({ search: searchQuery }).then((r) => r.data.items),
    enabled: !!searchQuery,
  })

  const { data: sessions } = useQuery({
    queryKey: ['special-sessions', 'active'],
    queryFn: () => specialSessionApi.getActive().then((r) => r.data.sessions),
    refetchInterval: 60_000,
  })

  const { data: plans } = useQuery({
    queryKey: ['meal-plans'],
    queryFn: () => subscriptionApi.listPlans().then((r) => r.data.plans),
  })

  const categories = useMemo(
    () => (groupedData || []).map((g) => g.category).filter(Boolean),
    [groupedData]
  )

  const featuredItems = useMemo(() => {
    if (!groupedData) return []
    // Extract unique featured items from all categories, exclude combos
    const all = groupedData.flatMap(g => g.items).filter(i => i.isFeatured && !i.isCombo)
    return Array.from(new Map(all.map(item => [item._id, item])).values())
  }, [groupedData])

  const combos = useMemo(() => {
    if (!groupedData) return []
    // Extract unique combos
    const all = groupedData.flatMap(g => g.items).filter(i => i.isCombo)
    return Array.from(new Map(all.map(item => [item._id, item])).values())
  }, [groupedData])

  const handleCategorySelect = (categoryId) => {
    if (!categoryId) {
      navigate('/category/all')
    } else {
      navigate(`/category/${categoryId}`)
    }
  }

  // Removed the useEffect that handled hash scrolling since we now navigate away.

  if (searchQuery) {
    return (
      <div className="pb-8">
        <div className="px-4 pt-5">
          <h2 className="font-display text-lg text-foreground mb-3">
            Results for &ldquo;{searchQuery}&rdquo;
          </h2>
          {isSearchLoading && <p className="text-sm text-muted-foreground">Searching...</p>}
          {!isSearchLoading && searchResults?.length === 0 && (
            <p className="text-sm text-muted-foreground">No dishes matched that search.</p>
          )}
          <div className="grid grid-cols-2 gap-3">
            {searchResults?.map((item) => (
              <MenuItemCard key={item._id} item={item} />
            ))}
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="pb-8">
      {!isMenuLoading && categories.length > 0 && (
        <div
          className="sticky top-0 z-[var(--gs-z-sticky,1100)] bg-background/95 backdrop-blur pt-4 pb-2"
          style={{ boxShadow: 'var(--gs-shadow-sm)' }}
        >
          <CategoryChips categories={categories} activeId={null} onSelect={handleCategorySelect} />
        </div>
      )}

      {/* Special Sessions Items Section */}
      {sessions?.length > 0 && sessions.map(session => (
        <section key={`items-${session._id}`} className="pt-6">
          <h2 className="px-4 font-display text-[1.35rem] font-bold text-primary mb-3 flex items-center gap-2">
            ⏰ {session.displayName} 
            <span className="text-xs bg-primary/10 text-primary px-2 py-0.5 rounded-full">
              -{session.discountPercent}% OFF
            </span>
          </h2>
          <div className="flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {session.items.map(item => (
              <div key={item._id} className="w-55 shrink-0">
                <MenuItemCard item={item} />
              </div>
            ))}
          </div>
        </section>
      ))}

      {isMenuLoading && (
        <div className="px-4 pt-6 grid grid-cols-2 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="aspect-4/3 gs-skeleton" />
          ))}
        </div>
      )}

      {!isMenuLoading && featuredItems.length > 0 && (
        <section className="pt-6">
          <h2 className="px-4 font-display text-[1.35rem] font-bold text-foreground mb-3 flex items-center gap-2">
            ⭐ Top Items
          </h2>
          <div className="flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {featuredItems.map(item => (
              <div key={item._id} className="w-55 shrink-0">
                <MenuItemCard item={item} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Top Drinks Section */}
      {!isMenuLoading && groupedData?.find(g => g.category.name.toLowerCase() === 'drinks') && (
        (() => {
          const drinksGroup = groupedData.find(g => g.category.name.toLowerCase() === 'drinks')
          const drinksItems = drinksGroup.items.filter(i => !i.isCombo).slice(0, 5) // Show top 5 drinks
          return drinksItems.length > 0 ? (
            <section className="pt-6">
              <h2 className="px-4 font-display text-[1.35rem] font-bold text-foreground mb-3 flex items-center gap-2">
                🥤 Top Drinks
              </h2>
              <div className="flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
                {drinksItems.map(item => (
                  <div key={item._id} className="w-55 shrink-0">
                    <MenuItemCard item={item} />
                  </div>
                ))}
                {/* See More Card */}
                {drinksGroup.items.length > 5 && (
                  <button
                    onClick={() => navigate(`/category/${drinksGroup.category._id}`)}
                    aria-label="See more drinks"
                    className="w-55 shrink-0 border-2 border-dashed border-primary/30 flex flex-col items-center justify-center gap-2 text-primary hover:bg-primary/5 transition-colors active:scale-95 gs-focus-ring"
                    style={{ borderRadius: 'var(--gs-radius-2xl, 1.5rem)' }}
                  >
                    <div className="h-10 w-10 rounded-full bg-primary/10 flex items-center justify-center">
                      <span className="text-xl" aria-hidden="true">🍹</span>
                    </div>
                    <span className="text-sm font-semibold">See More</span>
                  </button>
                )}
              </div>
            </section>
          ) : null
        })()
      )}

      {/* Celebrations Section (Between Top Drinks and Combos) */}
      <section className="pt-4 pb-4 px-4">
        <div
          className="rounded-[var(--gs-radius-2xl,1.5rem)] p-5 text-white shadow-lg relative overflow-hidden"
          style={{
            background: 'linear-gradient(135deg, var(--gs-primary, #1B3A25) 0%, #2D5C3A 100%)',
            boxShadow: 'var(--gs-shadow-lg)',
          }}
        >
          <div className="absolute -right-4 -top-4 text-7xl opacity-20" aria-hidden="true">🎉</div>
          <h2
            className="font-display text-xl font-bold mb-2 relative z-10"
            style={{ color: 'var(--gs-bg, #FAF8F5)' }}
          >
            Plan a Celebration?
          </h2>
          <p
            className="text-sm mb-4 relative z-10 w-4/5"
            style={{ color: 'rgba(250,248,245,0.85)' }}
          >
            Birthdays, anniversaries, or get-togethers. Book in advance and customize your menu!
          </p>
          <button
            onClick={() => navigate('/celebrations')}
            className="px-5 py-2.5 rounded-[var(--gs-radius-lg,0.75rem)] text-sm font-bold transition-all active:scale-95 relative z-10 gs-focus-ring"
            style={{
              backgroundColor: 'var(--gs-secondary, #B58A63)',
              color: 'var(--gs-primary, #1B3A25)',
              boxShadow: 'var(--gs-shadow-sm)',
            }}
          >
            Book Celebration
          </button>
        </div>
      </section>

      {/* Combos Section (After Celebration) */}
      {!isMenuLoading && combos.length > 0 && (
        <section className="pt-4 pb-2">
          <div className="flex items-center justify-between mb-3 px-4">
            <h2 className="font-display text-[1.35rem] font-bold text-foreground flex items-center gap-2">
              🍱 Special Combos
            </h2>
          </div>
          <div className="flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {combos.map((combo) => (
              <div key={combo._id} className="w-55 shrink-0">
                <MenuItemCard item={combo} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Plans Section (After Combos) */}
      {plans && plans.length > 0 && (
        <section className="pt-4 pb-6">
          <div className="flex items-center justify-between mb-3 px-4">
            <h2 className="font-display text-[1.35rem] font-bold text-foreground">
              📅 Meal Plans
            </h2>
            <Link to="/subscriptions" className="text-sm font-semibold text-primary">
              See all
            </Link>
          </div>
          <div className="flex gap-4 overflow-x-auto px-4 pb-4 no-scrollbar" style={{ scrollbarWidth: 'none' }}>
            {plans.map((plan) => (
              <div key={plan._id} className="w-55 shrink-0">
                <PlanCard
                  plan={plan}
                  disabled={false}
                  compact={true}
                  onSubscribe={() => navigate('/subscriptions')}
                />
              </div>
            ))}
          </div>
        </section>
      )}

    </div>
  )
}