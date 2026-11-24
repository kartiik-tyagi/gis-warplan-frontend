/**
 * Title-case short UI labels (buttons, chips, menu items).
 * Leaves ALL-CAPS tokens (ORBAT, APEX, CRS) alone. Does not rewrite full sentences.
 */
export function titleCase(value) {
  const text = String(value ?? '').trim()
  if (!text) return text
  return text
    .split(/(\s+)/)
    .map((token) => {
      if (/^\s+$/.test(token)) return token
      if (/^[A-Z0-9]{2,}(?:\/[A-Z0-9]+)*$/.test(token)) return token
      const match = token.match(/^([^A-Za-z0-9]*)(.*?)([^A-Za-z0-9]*)$/)
      if (!match) return token
      const [, lead, core, trail] = match
      if (!core) return token
      if (/^[A-Z0-9]{2,}$/.test(core)) return token
      return `${lead}${core.charAt(0).toUpperCase()}${core.slice(1)}${trail}`
    })
    .join('')
}
