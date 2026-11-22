import { Typography } from '@mui/material'
import { useSessionStore } from '../../../features/session/useSessionStore'
import { canOpenOrbat } from '../../auth/access'
import OrbatPanel from '../../../features/orbat/OrbatPanel'
import { ScenarioAdminPanel, GameAdminPanel } from '../../../features/scenario/ExerciseAdminPanels'
import { FilterList } from '../FilterList'

function Caption({ children }) {
  return (
    <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
      {children}
    </Typography>
  )
}

export function PanelBody({ panel }) {
  if (panel === 'filters') return <FilterList />
  if (panel === 'orbat') return <OrbatGate />
  if (panel === 'scenario-admin') return <ScenarioAdminPanel />
  if (panel === 'game-admin') return <GameAdminPanel />
  return <Caption>This panel is not available.</Caption>
}

function OrbatGate() {
  const functionalities = useSessionStore((state) => state.session?.functionalities)
  if (!canOpenOrbat(functionalities)) return <Caption>Your role does not include ORBAT.</Caption>
  return <OrbatPanel />
}
