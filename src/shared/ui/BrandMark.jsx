import { Box } from '@mui/material'
import { APP_MARK_SRC, APP_NAME } from '../brand'

/** Product mark next to the brand name. Swap the file via `APP_MARK_SRC` in `shared/brand.js`. */
export function BrandMark({ size = 28, sx }) {
  return (
    <Box
      component="img"
      src={APP_MARK_SRC}
      alt={APP_NAME}
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
