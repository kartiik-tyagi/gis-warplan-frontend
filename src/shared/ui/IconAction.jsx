import { Box, IconButton, Tooltip } from '@mui/material'
import { titleCase } from '../lib/titleCase'

/** Icon-only action — label lives in tooltip / aria-label (title-cased). */
export function IconAction({
  label,
  icon,
  onClick,
  disabled = false,
  color = 'default',
  size = 'small',
  edge,
  variant = 'icon',
  type = 'button',
}) {
  const titled = titleCase(label)
  const contained = variant === 'contained'
  return (
    <Tooltip title={titled}>
      <Box component="span" sx={{ display: 'inline-flex', alignItems: 'center', lineHeight: 0 }}>
        <IconButton
          type={type}
          aria-label={titled}
          size={size}
          color={contained ? 'primary' : color}
          edge={edge}
          disabled={disabled}
          onClick={onClick}
          sx={
            contained
              ? {
                  bgcolor: 'primary.main',
                  color: 'primary.contrastText',
                  borderRadius: 1,
                  '&:hover': { bgcolor: 'primary.dark' },
                  '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
                }
              : undefined
          }
        >
          {icon}
        </IconButton>
      </Box>
    </Tooltip>
  )
}
