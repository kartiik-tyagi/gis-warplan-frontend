import { Box, Typography } from '@mui/material'
import { formatElevationMeters, useElevation } from '../map/useElevation'
import { useSessionStore } from '../../features/session/useSessionStore'

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

function Field({ label, value, title }) {
  return (
    <Typography variant="caption" noWrap title={title} sx={{ color: 'text.primary', fontWeight: 400 }}>
      <Box component="span" sx={{ fontWeight: 700 }}>{label}</Box>
      {' '}
      {value}
    </Typography>
  )
}

export function StatusFooter({ readout }) {
  const mapView = useSessionStore((state) => state.session?.mapView)
  const dataCrs = readout?.dataCrs || mapView?.dataCrs || 'EPSG:4326'
  const { elevation, kind } = useElevation(readout?.latitude, readout?.longitude)
  const elevLabel = kind === 'depth' ? 'Depth' : 'Height'
  const elevValue = formatElevationMeters(elevation)

  return (
    <Box
      component="footer"
      aria-label="Map readout"
      sx={{
        minHeight: 32,
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
      <Field label="Latitude" value={hemisphere(readout?.latitude, 'N', 'S')} />
      <Field label="Longitude" value={hemisphere(readout?.longitude, 'E', 'W')} />
      <Field
        label={elevLabel}
        value={elevValue}
        title={kind === 'depth' ? 'Ocean depth from the elevation layer' : 'Land height from the elevation layer'}
      />
      <Field label="Zoom" value={formatZoom(readout?.zoom)} />
      <Field label="CRS" value={dataCrs} title="Coordinate system of the latitude and longitude." />
    </Box>
  )
}
