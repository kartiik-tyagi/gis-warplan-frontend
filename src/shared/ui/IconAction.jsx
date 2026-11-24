import { IconButton, Tooltip } from '@mui/material'
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
}) {
  const titled = titleCase(label)
  return (
    <Tooltip title={titled}>
      <span>
        <IconButton
          aria-label={titled}
          size={size}
          color={color}
          edge={edge}
          disabled={disabled}
          onClick={onClick}
        >
          {icon}
        </IconButton>
      </span>
    </Tooltip>
  )
}
