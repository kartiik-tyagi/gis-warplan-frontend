import { Box } from '@mui/material'
import { APP_MARK_SRC } from '../brand'

/** Product mark next to the brand name. Swap the file via `APP_MARK_SRC` in `shared/brand.js`. */
export function BrandMark({ size = 28, name = '', sx }) {
  return (
    <Box
      component="img"
      src={APP_MARK_SRC}
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
