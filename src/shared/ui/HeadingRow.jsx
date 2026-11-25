import { Box } from '@mui/material'
import { alpha } from '@mui/material/styles'

/** A step lighter in dark themes and a step darker in light themes, taken from the active theme. */
export function headingBandColor(theme) {
  return theme.palette.mode === 'dark'
    ? alpha(theme.palette.common.white, 0.1)
    : alpha(theme.palette.common.black, 0.07)
}

/** Full-width heading bar so a title reads apart from the content under it. */
export function HeadingRow({ children, component = 'div', sx }) {
  return (
    <Box
      component={component}
      sx={[
        {
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          minHeight: 40,
          px: 1.5,
          py: 0.75,
          bgcolor: headingBandColor,
          color: 'text.primary',
          fontWeight: 650,
          '& .MuiTypography-root': { fontWeight: 650 },
        },
        ...(Array.isArray(sx) ? sx : sx ? [sx] : []),
      ]}
    >
      {children}
    </Box>
  )
}
