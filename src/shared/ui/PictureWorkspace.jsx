import { useEffect } from 'react'
import { Box, Typography, useMediaQuery } from '@mui/material'
import { useTheme } from '@mui/material/styles'
import DashboardOutlinedIcon from '@mui/icons-material/DashboardOutlined'
import MapOutlinedIcon from '@mui/icons-material/MapOutlined'
import { useDirectoryStore } from '../../features/directory/useDirectoryStore'
import { EMPTY_LIST } from '../lib/empty'
import { useSessionStore } from '../../features/session/useSessionStore'
import { FeatureTable } from './workbench/Panels'
import { IconAction } from './IconAction'
import { MapStage } from './MapStage'

function AlertStrip() {
  const alerts = useDirectoryStore((state) => state.data?.alerts ?? EMPTY_LIST)
  return (
    <Box sx={{ minHeight: 28, px: 1.5, display: 'flex', alignItems: 'center', gap: 2, bgcolor: 'background.paper', borderBottom: 1, borderColor: 'divider' }}>
      <Typography variant="caption" color="text.secondary">
        {alerts.length ? alerts.map((alert) => `${alert.name} in ${alert.zone}`).join(' · ') : 'No active alerts'}
      </Typography>
    </Box>
  )
}

export function PictureWorkspace({ variant = 'plain' }) {
  const theme = useTheme()
  const phone = useMediaQuery(theme.breakpoints.down('sm'))
  const surface = useDirectoryStore((state) => state.surface)
  const setSurface = useDirectoryStore((state) => state.setSurface)
  const phaseId = useSessionStore((state) => state.phaseId)
  const flags = useDirectoryStore((state) => state.data?.flags)
  const board = variant === 'phase' ? phaseId === 'plan' : surface === 'planning'

  useEffect(() => {
    if (variant !== 'phase') return
    setSurface(phaseId === 'plan' ? 'planning' : 'picture')
  }, [variant, phaseId, setSurface])

  const showTable = flags?.featureTable && !phone && (variant === 'dock' || (variant === 'phase' && phaseId === 'review'))
  const showAlerts = flags?.alertsPanel && variant === 'phase' && phaseId === 'conduct'

  return (
    <Box
      sx={{
        flex: 1,
        minWidth: 0,
        minHeight: 0,
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
      }}
    >
      {showAlerts ? <AlertStrip /> : null}
      <MapStage readout={variant === 'overlay' ? 'overlay' : 'bar'} />
      {variant === 'overlay' && flags?.planningCanvas ? (
        <Box sx={{ position: 'absolute', zIndex: 3, left: 12, bottom: 48 }}>
          <IconAction
            label={board ? 'Picture' : 'Board'}
            icon={board ? <MapOutlinedIcon fontSize="small" /> : <DashboardOutlinedIcon fontSize="small" />}
            onClick={() => setSurface(board ? 'picture' : 'planning')}
            variant="contained"
          />
        </Box>
      ) : null}
      {showTable ? (
        <Box sx={{ height: 180, overflow: 'auto', borderTop: 1, borderColor: 'divider', bgcolor: 'background.paper', px: 1 }}>
          <FeatureTable />
        </Box>
      ) : null}
    </Box>
  )
}
