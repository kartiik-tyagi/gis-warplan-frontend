import { Box } from '@mui/material'

/** Product mark. The address comes from the asset store. */
export function BrandMark({ size = 28, name = '', src = '', sx }) {
  if (!src) return null
  return (
    <Box
      component="img"
      src={src}
      alt={name || 'Application'}
      width={size}
      height={size}
      sx={{
        width: size,
        height: size,
        objectFit: 'contain',
        flexShrink: 0,
        display: 'block',
        ...sx,
      }}
    />
  )
}
