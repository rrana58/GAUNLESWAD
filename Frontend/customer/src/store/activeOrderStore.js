import { create } from 'zustand'
import { persist } from 'zustand/middleware'


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
