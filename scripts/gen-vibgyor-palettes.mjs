import fs from 'fs'
import path from 'path'
import { fileURLToPath } from 'url'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const paletteDir = path.join(__dirname, '../src/shared/theme/palette')
const seedPath = path.join(__dirname, '../../gis-warplan-backend/src/main/resources/seed/themes.json')

function channel(hex, shift) {
  const value = (parseInt(hex.slice(1), 16) >> shift) & 255
  const amount = value / 255
  return amount <= 0.04045 ? amount / 12.92 : ((amount + 0.055) / 1.055) ** 2.4
}

function luminance(hex) {
  return 0.2126 * channel(hex, 16) + 0.7152 * channel(hex, 8) + 0.0722 * channel(hex, 0)
}

function contrast(a, b) {
  const hi = Math.max(luminance(a), luminance(b))
  const lo = Math.min(luminance(a), luminance(b))
  return (hi + 0.05) / (lo + 0.05)
}

function bestContrast(bg, c1, c2) {
  return contrast(c1, bg) >= contrast(c2, bg) ? c1 : c2
}

function statusOn(bg, preferred, light, dark) {
  if (contrast(preferred, bg) >= 4.5) return preferred
  return bestContrast(bg, light, dark)
}

const WHITE = '#ffffff'
const BLACK = '#0a0a0a'
const ERR_L = '#fecaca'
const ERR_D = '#7f1d1d'
const WARN_L = '#fde68a'
const WARN_D = '#78350f'
const OK_L = '#bbf7d0'
const OK_D = '#14532d'
const INFO_L = '#bfdbfe'
const INFO_D = '#1e3a8a'

const bases = [
  { id: 'black', name: 'Black', family: 'Black', mode: 'dark', hue: '#fafafa', bg: '#000000', paper: '#171717' },
  { id: 'blue', name: 'Blue', family: 'Blue', mode: 'dark', hue: '#60a5fa', bg: '#0b1f3a', paper: '#123056', defaultTheme: true },
  { id: 'blue-dark', name: 'Blue Dark', family: 'Blue', mode: 'dark', hue: '#93c5fd', bg: '#061018', paper: '#0a1a2e' },
  { id: 'blue-light', name: 'Blue Light', family: 'Blue', mode: 'light', hue: '#1d4ed8', bg: '#dbeafe', paper: '#bfdbfe' },
  { id: 'green', name: 'Green', family: 'Green', mode: 'dark', hue: '#4ade80', bg: '#0c2618', paper: '#143d26' },
  { id: 'green-dark', name: 'Green Dark', family: 'Green', mode: 'dark', hue: '#86efac', bg: '#06140c', paper: '#0c2416' },
  { id: 'green-light', name: 'Green Light', family: 'Green', mode: 'light', hue: '#15803d', bg: '#dcfce7', paper: '#bbf7d0' },
  { id: 'indigo', name: 'Indigo', family: 'Indigo', mode: 'dark', hue: '#818cf8', bg: '#12163a', paper: '#1c2254' },
  { id: 'orange', name: 'Orange', family: 'Orange', mode: 'dark', hue: '#fb923c', bg: '#2a1608', paper: '#40210c' },
  { id: 'red', name: 'Red', family: 'Red', mode: 'dark', hue: '#f87171', bg: '#2a1010', paper: '#401818' },
  { id: 'red-dark', name: 'Red Dark', family: 'Red', mode: 'dark', hue: '#fca5a5', bg: '#160808', paper: '#261010' },
  { id: 'red-light', name: 'Red Light', family: 'Red', mode: 'light', hue: '#b91c1c', bg: '#fee2e2', paper: '#fecaca' },
  { id: 'violet', name: 'Violet', family: 'Violet', mode: 'dark', hue: '#8b5cf6', bg: '#1e1033', paper: '#2d1b4e' },
  { id: 'white', name: 'White', family: 'White', mode: 'light', hue: '#171717', bg: '#ffffff', paper: '#f4f4f5' },
  { id: 'yellow', name: 'Yellow', family: 'Yellow', mode: 'dark', hue: '#facc15', bg: '#2a2208', paper: '#3f330c' },
  { id: 'yellow-dark', name: 'Yellow Dark', family: 'Yellow', mode: 'dark', hue: '#fde047', bg: '#1a1404', paper: '#2a2008' },
  { id: 'yellow-light', name: 'Yellow Light', family: 'Yellow', mode: 'light', hue: '#a16207', bg: '#fef9c3', paper: '#fde68a' },
]

function build(row) {
  const dark = row.mode === 'dark'
  const textPrimary = dark ? '#f8fafc' : '#0f172a'
  const textSecondary = dark ? '#cbd5e1' : '#334155'
  const textDisabled = dark ? '#94a3b8' : '#64748b'
  const primary = row.hue
  const primaryContrast = bestContrast(primary, WHITE, BLACK)
  const error = statusOn(row.paper, dark ? ERR_L : ERR_D, ERR_L, ERR_D)
  const warning = statusOn(row.paper, dark ? WARN_L : WARN_D, WARN_L, WARN_D)
  const success = statusOn(row.paper, dark ? OK_L : OK_D, OK_L, OK_D)
  const info = statusOn(row.paper, dark ? INFO_L : INFO_D, INFO_L, INFO_D)
  const palette = {
    id: row.id,
    name: row.name,
    family: row.family,
    mode: row.mode,
    fontFamily: '"Roboto", "Segoe UI", sans-serif',
    fontWeightLight: 300,
    fontWeightRegular: 400,
    fontWeightMedium: 500,
    fontWeightBold: 700,
    borderRadius: 8,
    primary,
    primaryContrast,
    secondary: primary,
    secondaryContrast: primaryContrast,
    backgroundDefault: row.bg,
    backgroundPaper: row.paper,
    textPrimary,
    textSecondary,
    textDisabled,
    divider: dark ? 'rgba(248, 250, 252, 0.28)' : 'rgba(15, 23, 42, 0.22)',
    error,
    errorContrast: bestContrast(error, WHITE, BLACK),
    warning,
    warningContrast: bestContrast(warning, WHITE, BLACK),
    success,
    successContrast: bestContrast(success, WHITE, BLACK),
    info,
    infoContrast: bestContrast(info, WHITE, BLACK),
  }

  const pairs = [
    ['body on panel', palette.textPrimary, palette.backgroundPaper, 4.5],
    ['caption on panel', palette.textSecondary, palette.backgroundPaper, 4.5],
    ['body on page', palette.textPrimary, palette.backgroundDefault, 4.5],
    ['action text', palette.primaryContrast, palette.primary, 4.5],
    ['error on panel', palette.error, palette.backgroundPaper, 4.5],
    ['error on page', palette.error, palette.backgroundDefault, 4.5],
    ['error text', palette.errorContrast, palette.error, 4.5],
    ['warning on panel', palette.warning, palette.backgroundPaper, 4.5],
    ['warning on page', palette.warning, palette.backgroundDefault, 4.5],
    ['warning text', palette.warningContrast, palette.warning, 4.5],
    ['success on panel', palette.success, palette.backgroundPaper, 4.5],
    ['success on page', palette.success, palette.backgroundDefault, 4.5],
    ['success text', palette.successContrast, palette.success, 4.5],
    ['info on panel', palette.info, palette.backgroundPaper, 4.5],
    ['info on page', palette.info, palette.backgroundDefault, 4.5],
    ['info text', palette.infoContrast, palette.info, 4.5],
    ['quiet text on panel', palette.textDisabled, palette.backgroundPaper, 3.2],
    ['quiet text on page', palette.textDisabled, palette.backgroundDefault, 3.2],
  ]
  for (const [label, ink, ground, floor] of pairs) {
    const c = contrast(ink, ground)
    if (c < floor) throw new Error(`${row.id} fails contrast for ${label}: ${c.toFixed(2)}`)
  }
  return palette
}

const palettes = bases.map(build).sort((a, b) => a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }))

const oldDirs = ['pine', 'amber', 'cobalt', 'copper', 'crimson', 'graphite', 'contrast', 'iris', 'lagoon', 'moss']
for (const dir of oldDirs) {
  const full = path.join(paletteDir, dir)
  if (fs.existsSync(full)) fs.rmSync(full, { recursive: true, force: true })
}

for (const palette of palettes) {
  const file = path.join(paletteDir, `${palette.id}.js`)
  const body = `const palette = ${JSON.stringify(palette, null, 2)}\n\nexport default palette\n`
  fs.writeFileSync(file, body)
}

const index = `import { assertContrast } from './check'
${palettes.map((p) => `import ${p.id.replace(/-/g, '_')} from './${p.id}'`).join('\n')}

export const palettes = [
${palettes.map((p) => `  ${p.id.replace(/-/g, '_')},`).join('\n')}
]

palettes.forEach(assertContrast)

export function paletteById(id) {
  return palettes.find((item) => item.id === id) || null
}

export const loginPalette = paletteById('blue')
`
fs.writeFileSync(path.join(paletteDir, 'index.js'), index)

const seeds = palettes.map((palette) => ({
  name: palette.name,
  description: `${palette.name} palette`,
  defaultTheme: Boolean(bases.find((b) => b.id === palette.id)?.defaultTheme),
  configJson: {
    paletteId: palette.id,
    ...palette,
  },
}))
fs.writeFileSync(seedPath, `${JSON.stringify(seeds, null, 2)}\n`)

console.log(`Wrote ${palettes.length} palettes and seed themes.json`)
