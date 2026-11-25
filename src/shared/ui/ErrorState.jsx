import { Alert, AlertTitle } from '@mui/material'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import { IconAction } from './IconAction'

export function ErrorState({ title = 'Something went wrong', message, onRetry }) {
  return (
    <Alert
      severity="error"
      action={
        onRetry ? (
          <IconAction label="Try again" icon={<RefreshOutlinedIcon fontSize="small" />} onClick={onRetry} />
        ) : null
      }
    >
      <AlertTitle>{title}</AlertTitle>
      {message}
    </Alert>
  )
}
