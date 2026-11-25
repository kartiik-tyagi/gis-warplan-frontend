import { Box, Stack } from '@mui/material'
import { swatchForColour } from '../api/mappers'
import { swatches } from '../theme/swatches'
import { SearchSelect } from './SearchSelect'

export const SIDE_ICON_COLOR_FALLBACK = '#2f6fed'

function normal(value) {
  return String(value || '').trim().toLowerCase()
}

function asHex(value) {
  const raw = String(value || '').trim()
  return /^#[0-9A-Fa-f]{6}$/.test(raw) ? raw : SIDE_ICON_COLOR_FALLBACK
}

/** Picks a side icon colour from the 12 swatches or a free colour picker. Value is always a hex. */
export function SideIconColorField({
  colour,
  onChange,
  size,
  label = 'Side Icon Color',
}) {
  const hex = asHex(colour)
  const match = swatchForColour(hex)
  const swatchId = match?.id || 'custom'
  const options = swatchId === 'custom' ? [{ id: 'custom', name: hex }, ...swatches] : swatches

  return (
    <Stack spacing={0.75}>
      <SearchSelect
        size={size}
        label={label}
        options={options}
        value={swatchId}
        onChange={(id) => {
          if (id === 'custom') onChange(hex)
          else onChange(swatches.find((item) => item.id === id)?.color || SIDE_ICON_COLOR_FALLBACK)
        }}
        getOptionLabel={(swatch) => swatch.name}
        getOptionValue={(swatch) => swatch.id}
      />
      <Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
        {swatches.map((swatch) => (
          <Box
            key={swatch.id}
            component="button"
            type="button"
            aria-label={swatch.name}
            aria-pressed={normal(swatch.color) === normal(hex)}
            onClick={() => onChange(swatch.color)}
            sx={{
              width: 22,
              height: 22,
              p: 0,
              borderRadius: 0.5,
              bgcolor: swatch.color,
              border: 2,
              borderColor: normal(swatch.color) === normal(hex) ? 'primary.main' : 'divider',
              cursor: 'pointer',
            }}
          />
        ))}
        <Box
          component="input"
          type="color"
          aria-label={`${label} picker`}
          value={hex}
          onChange={(event) => onChange(event.target.value)}
          sx={{ width: 28, height: 22, p: 0, border: 1, borderColor: 'divider', bgcolor: 'transparent', cursor: 'pointer' }}
        />
      </Stack>
    </Stack>
  )
}
