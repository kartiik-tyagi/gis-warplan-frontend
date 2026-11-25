import { useEffect } from 'react'
import { Box, Checkbox, FormControlLabel, Typography } from '@mui/material'
import { useSessionStore } from '../../features/session/useSessionStore'
import { BrandMark } from './BrandMark'
import { ScenarioContext } from './ScenarioContext'
import { UserMenu } from './UserMenu'

function ViewModes({ mode, onChange }) {
  if (!onChange) return null
  const choice = (id, label) => (
    <FormControlLabel
      control={<Checkbox size="small" checked={mode === id} onChange={() => onChange(id)} />}
      label={label}
      sx={{ mr: 1, '& .MuiFormControlLabel-label': { fontSize: 13 } }}
    />
  )
  return (
    <Box role="group" aria-label="Map view" sx={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
      {choice('default', 'Default')}
      {choice('grid', 'Grid')}
    </Box>
  )
}

export function TopBar({ leading, trailing, menuOpen, onMenuOpenChange, floating = false, viewMode = 'default', onViewMode }) {
  const applicationName = useSessionStore((state) => state.session?.applicationName || '')

  useEffect(() => {
    if (applicationName) document.title = applicationName
  }, [applicationName])

  return (
    <Box
      component="header"
      sx={{
        minHeight: 48,
        width: '100%',
        minWidth: 0,
        px: 1,
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        overflow: 'hidden',
        borderBottom: floating ? 0 : 1,
        borderColor: 'divider',
        bgcolor: floating ? 'transparent' : 'background.paper',
        color: 'text.primary',
      }}
    >
      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, minWidth: 0, flexShrink: 1 }}>
        <BrandMark size={26} name={applicationName} />
        <Typography variant="subtitle2" noWrap sx={{ letterSpacing: { xs: '0.08em', sm: '0.14em' }, px: 0.25, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis' }}>
          {applicationName}
        </Typography>
      </Box>
      {leading}
      <ViewModes mode={viewMode} onChange={onViewMode} />
      <Box sx={{ flex: 1, minWidth: 0, display: { xs: 'none', lg: 'flex' }, alignItems: 'center', overflow: 'hidden' }}>
        <ScenarioContext />
      </Box>
      <Box sx={{ flex: { xs: 1, lg: 0 } }} />
      {trailing}
      <UserMenu open={menuOpen} onOpenChange={onMenuOpenChange} />
    </Box>
  )
}

export function ContextStrip() {
  return (
    <Box
      sx={{
        display: { xs: 'flex', lg: 'none' },
        alignItems: 'center',
        width: '100%',
        minWidth: 0,
        gap: 2,
        px: 1.5,
        py: 0.75,
        overflow: 'hidden',
        borderBottom: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <ScenarioContext />
    </Box>
  )
}
