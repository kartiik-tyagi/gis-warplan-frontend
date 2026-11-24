import { IconButton, Tooltip } from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { titleCase } from '../lib/titleCase'

/** Contained “+” create control — label lives in the tooltip / aria-label only. */
export function CreateAction({ label, onClick, disabled = false, size = 'small' }) {
  const titled = titleCase(label)
  return (
    <Tooltip title={titled}>
      <span>
        <IconButton
          color="primary"
          size={size}
          aria-label={titled}
          disabled={disabled}
          onClick={onClick}
          sx={{
            bgcolor: 'primary.main',
            color: 'primary.contrastText',
            borderRadius: 1,
            '&:hover': { bgcolor: 'primary.dark' },
            '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
          }}
        >
          <AddIcon fontSize="small" />
        </IconButton>
      </span>
    </Tooltip>
  )
}
