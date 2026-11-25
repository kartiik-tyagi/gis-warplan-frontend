import { createTheme } from '@mui/material/styles'

/** Theme colours an icon is allowed to reference. The same names are enforced when a drawing is saved. */

export const ICON_TOKENS = [
  { id: 'primary', label: 'Primary' },
  { id: 'primaryContrast', label: 'On primary' },
  { id: 'secondary', label: 'Secondary' },
  { id: 'secondaryContrast', label: 'On secondary' },
  { id: 'error', label: 'Error' },
  { id: 'errorContrast', label: 'On error' },
  { id: 'warning', label: 'Warning' },
  { id: 'warningContrast', label: 'On warning' },
  { id: 'success', label: 'Success' },
  { id: 'successContrast', label: 'On success' },
  { id: 'info', label: 'Info' },
  { id: 'infoContrast', label: 'On info' },
  { id: 'textPrimary', label: 'Text' },
  { id: 'textSecondary', label: 'Secondary text' },
  { id: 'textDisabled', label: 'Disabled text' },
  { id: 'backgroundPaper', label: 'Paper' },
  { id: 'backgroundDefault', label: 'Background' },
  { id: 'divider', label: 'Divider' },
]

export const ICON_TOKEN_IDS = new Set(ICON_TOKENS.map((token) => token.id))

function pick(value, fallback) {
  return value == null || value === '' ? fallback : value
}

function asHex(value) {
  const raw = String(value || '').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw : ''
}

/**
 * Overrides primary so Side Icon Color drives themed icon paints (var(--wp-primary)).
 * Other tokens keep the side's UI theme.
 */
export function applySideIconColor(theme, colour) {
  const hex = asHex(colour)
  if (!theme || !hex) return theme
  return createTheme(theme, {
    palette: {
      primary: {
        main: hex,
        contrastText: theme.palette?.primary?.contrastText || '#0a0a0a',
      },
    },
  })
}

/** CSS variables for one MUI theme. Inline SVG paints with var(--wp-*) follow whoever is looking. */
export function iconCssVars(theme) {
  const palette = theme?.palette || {}
  return {
    '--wp-primary': pick(palette.primary?.main, '#60a5fa'),
    '--wp-primaryContrast': pick(palette.primary?.contrastText, '#0a0a0a'),
    '--wp-secondary': pick(palette.secondary?.main, '#60a5fa'),
    '--wp-secondaryContrast': pick(palette.secondary?.contrastText, '#0a0a0a'),
    '--wp-error': pick(palette.error?.main, '#fecaca'),
    '--wp-errorContrast': pick(palette.error?.contrastText, '#0a0a0a'),
    '--wp-warning': pick(palette.warning?.main, '#fde68a'),
    '--wp-warningContrast': pick(palette.warning?.contrastText, '#0a0a0a'),
    '--wp-success': pick(palette.success?.main, '#bbf7d0'),
    '--wp-successContrast': pick(palette.success?.contrastText, '#0a0a0a'),
    '--wp-info': pick(palette.info?.main, '#bfdbfe'),
    '--wp-infoContrast': pick(palette.info?.contrastText, '#0a0a0a'),
    '--wp-textPrimary': pick(palette.text?.primary, '#f8fafc'),
    '--wp-textSecondary': pick(palette.text?.secondary, '#cbd5e1'),
    '--wp-textDisabled': pick(palette.text?.disabled, '#94a3b8'),
    '--wp-backgroundPaper': pick(palette.background?.paper, '#123056'),
    '--wp-backgroundDefault': pick(palette.background?.default, '#0b1f3a'),
    '--wp-divider': pick(palette.divider, 'rgba(248, 250, 252, 0.28)'),
  }
}

export function tokenColor(theme, id) {
  return iconCssVars(theme)[`--wp-${id}`]
}

/**
 * Copies an SVG for a context that cannot see page CSS, such as a map image.
 * Theme tokens become the viewer's real colours. A fixed hex or rgb colour is left unchanged.
 */
export function resolveThemedSvg(markup, theme) {
  const vars = iconCssVars(theme)
  return String(markup || '')
    .replace(/var\(\s*--wp-([A-Za-z]+)\s*\)/g, (match, token) => vars[`--wp-${token}`] || match)
    .replace(/\bcurrentColor\b/g, vars['--wp-textPrimary'])
}
