import { get } from './http'

let pending = null

/** The moon-phase list from the backend enum. One request is shared by the game forms and the command bar. */
export function loadMoonPhases() {
  if (!pending) {
    pending = get('/games/moon-phases')
      .then((rows) => (Array.isArray(rows) ? rows : []))
      .catch((error) => {
        pending = null
        throw error
      })
  }
  return pending
}

export function moonPhaseOf(phases, code) {
  if (!code) return null
  return (phases || []).find((phase) => phase.code === code) || null
}

export function moonPhaseLabel(phases, code) {
  return moonPhaseOf(phases, code)?.label || ''
}
