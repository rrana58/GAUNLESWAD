import { create } from 'zustand'
import { persist } from 'zustand/middleware'

/** Remembers the customer's current in-progress order so a persistent
 *  tracking bar can follow them across the app (Home/Cart/Profile/etc),
 *  the same way Pathao Food does. `ref` is either the order's Mongo _id
 *  (logged-in) or its guest trackingToken — whichever `/track/:ref` needs.
 *  Persisted so it survives closing and reopening the app. */
export const useActiveOrderStore = create(
  persist(
    (set) => ({
      ref: null,
      setActiveOrder: (ref) => set({ ref }),
      clearActiveOrder: () => set({ ref: null }),
    }),
    { name: 'gharko-swad-active-order' }
  )
)
