import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import api from '@/api/axios'


function lineKey(item) {
  return [item.menuItemId, item.specialInstructions || ''].join('|')
}

// Helper to notify backend (fire and forget)
const syncCartWithServer = async (items) => {
  // Only sync when logged in — unauthenticated calls hit a protected endpoint
  // and generate noise in the security log (401 for every guest cart change).
  try {
    const { useAuthStore } = await import('@/store/authStore')
    if (!useAuthStore.getState().isAuthenticated) return
    await api.post('/auth/cart-activity', { hasItems: items.length > 0 })
  } catch {
    // Ignore errors — this is background telemetry only
  }
}

export const useCartStore = create(
  persist(
    (set, get) => ({
      items: [],

      addItem: (item) => {
        const key = lineKey(item)
        const existing = get().items.find((i) => lineKey(i) === key)
        if (existing) {
          const newItems = get().items.map((i) =>
            lineKey(i) === key ? { ...i, quantity: i.quantity + item.quantity } : i
          );
          set({ items: newItems })
          syncCartWithServer(newItems);
        } else {
          const newItems = [...get().items, item];
          set({ items: newItems })
          syncCartWithServer(newItems);
        }
      },

      updateQuantity: (key, quantity) => {
        if (quantity <= 0) return get().removeItem(key)
        const newItems = get().items.map((i) => (lineKey(i) === key ? { ...i, quantity } : i));
        set({ items: newItems })
        syncCartWithServer(newItems);
      },

      removeItem: (key) => {
        const newItems = get().items.filter((i) => lineKey(i) !== key);
        set({ items: newItems });
        syncCartWithServer(newItems);
      },

      clear: () => {
        set({ items: [] });
        syncCartWithServer([]);
      },

      
      getSubtotal: () => get().items.reduce((sum, i) => sum + i.price * i.quantity, 0),
      getItemCount: () => get().items.reduce((sum, i) => sum + i.quantity, 0),
    }),
    { name: 'gharko-swad-cart' }
  )
)

export { lineKey }