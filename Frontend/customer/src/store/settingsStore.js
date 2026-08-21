import { create } from 'zustand'
import { settingsApi } from '@/api/orders'

// App-wide public settings — maintenance mode, global discount, delivery
// threshold/fee. Fetched once (MobileShell) and read anywhere via this
// store instead of each screen hardcoding its own copy of these numbers.
export const useSettingsStore = create((set) => ({
  loaded: false,
  maintenanceMode: false,
  maintenanceMessage: '',
  globalDiscountPercent: 0,
  globalDiscountLabel: 'Global Discount',
  freeDeliveryAbove: 500,
  deliveryFee: 50,
  kitchenLocation: null,
  maxDeliveryDistanceKm: null,
  deliveryZones: [],

  fetchSettings: async () => {
    try {
      const { data } = await settingsApi.getPublic()
      set({
        loaded: true,
        maintenanceMode: !!data.maintenanceMode,
        maintenanceMessage: data.maintenanceMessage || '',
        globalDiscountPercent: data.globalDiscountPercent || 0,
        globalDiscountLabel: data.globalDiscountLabel || 'Global Discount',
        freeDeliveryAbove: data.freeDeliveryAbove ?? 500,
        deliveryFee: data.deliveryFee ?? 50,
        kitchenLocation: data.kitchenLocation || null,
        maxDeliveryDistanceKm: data.maxDeliveryDistanceKm ?? null,
        deliveryZones: data.deliveryZones || [],
      })
    } catch {
      // Keep defaults on failure — never block the app over a settings fetch
      set({ loaded: true })
    }
  },
}))