import { create } from 'zustand'
import { persist } from 'zustand/middleware'
import { clearAuthSession } from '@shared/auth'

export const useAuthStore = create(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: false,

      setAuth: (user, accessToken, refreshToken) => {
        set({ 
          user, 
          accessToken, 
          refreshToken, 
          isAuthenticated: true 
        })
      },

      logout: () => {
        clearAuthSession('admin')
        set({ 
          user: null, 
          accessToken: null, 
          refreshToken: null, 
          isAuthenticated: false 
        })
      },

      updateUser: (user) => set({ user }),
    }),
    {
      name: 'gharko-admin-auth',
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
)