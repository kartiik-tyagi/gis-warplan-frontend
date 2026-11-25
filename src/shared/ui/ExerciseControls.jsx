import { Stack } from '@mui/material'
import PauseIcon from '@mui/icons-material/Pause'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import ReplayIcon from '@mui/icons-material/Replay'
import StopIcon from '@mui/icons-material/Stop'
import { useSessionStore } from '../../features/session/useSessionStore'
import { IconAction } from './IconAction'

export function ExerciseControls() {
  const canControl = useSessionStore((state) => state.session?.canControlGame)
  const status = useSessionStore((state) => state.status)
  const start = useSessionStore((state) => state.start)
  const pause = useSessionStore((state) => state.pause)
  const resume = useSessionStore((state) => state.resume)
  const restart = useSessionStore((state) => state.restart)
  const end = useSessionStore((state) => state.end)
  if (!canControl) return null

  const actions = [
    { id: 'start', label: 'Start', icon: <PlayArrowIcon fontSize="small" />, onClick: start, disabled: status === 'running' || status === 'paused', variant: 'contained' },
    { id: 'pause', label: 'Pause', icon: <PauseIcon fontSize="small" />, onClick: pause, disabled: status !== 'running' },
    { id: 'resume', label: 'Resume', icon: <PlayArrowIcon fontSize="small" />, onClick: resume, disabled: status !== 'paused' },
    { id: 'restart', label: 'Restart', icon: <ReplayIcon fontSize="small" />, onClick: restart, disabled: status === 'ready' },
    { id: 'end', label: 'End', icon: <StopIcon fontSize="small" />, onClick: end, disabled: status === 'ready' || status === 'ended', color: 'warning' },
  ]

  return (
    <Stack direction="row" spacing={0.5} useFlexGap sx={{ flexWrap: 'wrap', alignItems: 'center' }}>
      {actions.map((action) => (
        <IconAction
          key={action.id}
          label={action.label}
          icon={action.icon}
          variant={action.variant}
          color={action.color}
          disabled={action.disabled}
          onClick={action.onClick}
        />
      ))}
    </Stack>
  )
}
