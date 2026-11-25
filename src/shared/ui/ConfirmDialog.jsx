import { Dialog, DialogActions, DialogContent, DialogTitle, Typography } from '@mui/material'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import CloseIcon from '@mui/icons-material/Close'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import { IconAction } from './IconAction'

function isDestructiveConfirm(label) {
  return /remove|delete/i.test(String(label || ''))
}

export function ConfirmDialog({ open, title, message, confirmLabel = 'Confirm', busy = false, error = '', onClose, onConfirm }) {
  const destructive = isDestructiveConfirm(confirmLabel)
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth="xs">
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Typography variant="body2">{message}</Typography>
        {error ? (
          <Typography variant="body2" color="error" sx={{ mt: 1.5 }}>
            {error}
          </Typography>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <IconAction label="Cancel" icon={<CloseIcon fontSize="small" />} onClick={onClose} disabled={busy} />
        <IconAction
          label={busy ? 'Working' : confirmLabel}
          icon={destructive ? <DeleteOutlinedIcon fontSize="small" /> : <CheckOutlinedIcon fontSize="small" />}
          onClick={onConfirm}
          disabled={busy}
          variant={destructive ? 'icon' : 'contained'}
          color={destructive ? 'error' : 'default'}
        />
      </DialogActions>
    </Dialog>
  )
}
