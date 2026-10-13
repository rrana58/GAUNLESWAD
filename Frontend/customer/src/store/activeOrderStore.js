import { create } from 'zustand'
import { persist } from 'zustand/middleware'

export const useActiveOrderStore = create(
  persist(
    (set) => ({
      refs: [],
      currentIndex: 0,

      setActiveOrder: (ref) =>
        set((state) => {
          if (!ref) return state
          if (state.refs.includes(ref)) {
            return {
              ...state,
              currentIndex: state.refs.indexOf(ref),
            }
          }

          return {
            refs: [...state.refs, ref],
            currentIndex: state.refs.length,
          }
        }),

      removeOrder: (ref) =>
        set((state) => {
          const index = state.refs.indexOf(ref)
          if (index === -1) return state

          const refs = state.refs.filter((item) => item !== ref)

          return {
            refs,
            currentIndex:
              refs.length === 0
                ? 0
                : Math.min(
                    index < state.currentIndex
                      ? state.currentIndex - 1
                      : state.currentIndex,
                    refs.length - 1
                  ),
          }
        }),

      nextOrder: () =>
        set((state) => ({
          currentIndex:
            state.refs.length > 0
              ? (state.currentIndex + 1) % state.refs.length
              : 0,
        })),

      previousOrder: () =>
        set((state) => ({
          currentIndex:
            state.refs.length > 0
              ? (state.currentIndex - 1 + state.refs.length) % state.refs.length
              : 0,
        })),

      clearActiveOrder: () =>
        set({
          refs: [],
          currentIndex: 0,
        }),
    }),
    { name: 'gharko-swad-active-orders' }
  )
)
