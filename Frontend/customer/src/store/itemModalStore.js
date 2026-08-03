import { create } from 'zustand'

export const useItemModalStore = create((set) => ({
  selectedItemId: null,
  isOpen: false,
  openModal: (itemId) => set({ selectedItemId: itemId, isOpen: true }),
  closeModal: () => set({ isOpen: false }),
  // When animation finishes, we can clear the ID if needed, but usually fine to keep it
}))
