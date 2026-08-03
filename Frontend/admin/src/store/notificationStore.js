import { create } from 'zustand'

const SOUND_PREF_KEY = 'gharko-admin-sound-enabled'

export const useNotificationStore = create((set) => ({
  unreadOrders: 0,
  soundEnabled: localStorage.getItem(SOUND_PREF_KEY) !== 'false',

  incrementUnread: () => set((s) => ({ unreadOrders: s.unreadOrders + 1 })),
  clearUnread: () => set({ unreadOrders: 0 }),

  toggleSound: () =>
    set((s) => {
      const next = !s.soundEnabled
      localStorage.setItem(SOUND_PREF_KEY, String(next))
      return { soundEnabled: next }
    }),
}))
