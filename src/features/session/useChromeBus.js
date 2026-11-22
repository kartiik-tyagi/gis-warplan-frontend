import { create } from 'zustand'

/**
 * Application-menu dock requests. `pinnedPanel` lives outside the map shell so it
 * survives a work window opening and closing. `dismiss` tells the toolbar dock to close.
 */
export const useChromeBus = create((set) => ({
  pinnedPanel: null,
  dismiss: 0,
  open: (panel) => set((state) => ({ pinnedPanel: panel, dismiss: state.dismiss + 1 })),
  close: () => set({ pinnedPanel: null }),
  dismissDock: () => set((state) => ({ pinnedPanel: null, dismiss: state.dismiss + 1 })),
}))
