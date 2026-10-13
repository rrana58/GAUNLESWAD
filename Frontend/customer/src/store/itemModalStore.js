import { create } from 'zustand'

export const useItemModalStore = create((set) => ({
  selectedItemId: null,
  selectedItem: null,
  isOpen: false,

  openModal: (itemId, item = null) =>
    set({
      selectedItemId: itemId,
      selectedItem: item,
      isOpen: true,
    }),

  closeModal: () =>
    set({
      isOpen: false,
      selectedItem: null,
    }),
}))