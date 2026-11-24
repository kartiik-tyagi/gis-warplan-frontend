import { Box, Typography } from '@mui/material'
import { formatElevationMeters, useElevation } from '../map/useElevation'

function hemisphere(value, positive, negative) {
  if (value == null || Number.isNaN(Number(value))) return '—'
  const number = Number(value)
  return `${Math.abs(number).toFixed(4)}° ${number >= 0 ? positive : negative}`
}

function formatZoom(zoom) {
  if (zoom == null || Number.isNaN(Number(zoom))) return '—'
  const rounded = Math.round(Number(zoom) * 10) / 10
  return Number.isInteger(rounded) ? String(rounded) : rounded.toFixed(1)
}

function formatScale(resolution) {
  if (!resolution || !Number.isFinite(resolution)) return '—'
  const denominator = resolution * (96 / 0.0254)
  const rounded = denominator >= 1000 ? Math.round(denominator / 1000) * 1000 : Math.round(denominator)
  return `1:${rounded.toLocaleString('en-US')}`
}

function Field({ label, value, title }) {
  return (
    <Typography variant="caption" noWrap title={title} sx={{ color: 'text.secondary' }}>
      {label}{' '}
      <Box component="span" sx={{ color: 'text.primary' }}>
        {value}
      </Box>
    </Typography>
  )
}

export function StatusFooter({ readout }) {
  const { elevation, kind } = useElevation(readout?.latitude, readout?.longitude)
  const elevLabel = kind === 'depth' ? 'Depth' : 'Height'
  const elevValue = formatElevationMeters(elevation)
  const elevTitle = kind === 'depth'
    ? 'Ocean depth at the pointer'
    : kind === 'height'
      ? 'Land height at the pointer'
      : 'Elevation at the pointer'

  return (
    <Box
      component="footer"
      aria-label="Map readout"
      sx={{
        minHeight: 28,
        px: 1.5,
        py: 0.25,
        flexShrink: 0,
        display: 'flex',
        alignItems: 'center',
        flexWrap: 'wrap',
        columnGap: 2,
        rowGap: 0.25,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        color: 'text.primary',
      }}
    >
      <Field label="Lat" value={hemisphere(readout?.latitude, 'N', 'S')} />
      <Field label="Long" value={hemisphere(readout?.longitude, 'E', 'W')} />
      <Field label={elevLabel} value={elevValue} title={elevTitle} />
      <Field label="Scale" value={formatScale(readout?.resolution)} />
      <Field label="Zoom" value={formatZoom(readout?.zoom)} />
      <Field label="CRS" value="EPSG:4326 · EPSG:3857" title="Cursor is geographic. The map is Web Mercator." />
    </Box>
  )
}
