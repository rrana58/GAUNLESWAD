import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { useCartStore } from './cartStore'
import { clearAuthSession } from '@shared/auth'
import { resetPushNotifications } from '@/utils/pushNotifications'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({ user, accessToken, refreshToken, isAuthenticated: true })
      },

      updateUser: (user) => set({ user }),

      logout: () => {
        clearAuthSession('customer')
        resetPushNotifications()
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false })
        useCartStore.getState().clear()
      },
    }),
    {
      name: 'gharko-swad-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)