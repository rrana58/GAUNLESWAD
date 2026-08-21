import { create } from 'zustand'

export const useItemModalStore = create((set) => ({
  selectedItemId: null,
  isOpen: false,
  openModal: (itemId) => set({ selectedItemId: itemId, isOpen: true }),
  closeModal: () => set({ isOpen: false }),
}))
