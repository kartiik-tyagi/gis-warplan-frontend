import { create } from 'zustand'

/** Which ORBAT the map is editing. The tools bar turns one on at a time. */
export const useMapOrbat = create((set, get) => ({
  mode: null,
  toggle: (mode) => set({ mode: get().mode === mode ? null : mode }),
  clear: () => set({ mode: null }),
}))
