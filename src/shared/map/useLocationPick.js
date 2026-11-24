import { create } from 'zustand'

let pickedAt = 0

/** True for a moment after a map click filled a form, so other map clicks do not also place a node. */
export function locationPickedJustNow() {
  return typeof performance !== 'undefined' && performance.now() - pickedAt < 400
}

/**
 * One form at a time can ask the map for a coordinate. Arm it, then the next map click
 * fills that form and disarms.
 */
export const useLocationPick = create((set, get) => ({
  armed: false,
  owner: null,
  token: 0,
  point: null,
  arm: (owner) => set({ armed: true, owner, point: null }),
  disarm: () => set({ armed: false }),
  offer: (latitude, longitude) => {
    if (!get().armed) return false
    pickedAt = typeof performance !== 'undefined' ? performance.now() : Date.now()
    set((state) => ({
      armed: false,
      point: {
        owner: state.owner,
        latitude: Math.round(latitude * 1e4) / 1e4,
        longitude: Math.round(longitude * 1e4) / 1e4,
      },
      token: state.token + 1,
    }))
    return true
  },
}))
