import { useEffect, useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { Box } from '@mui/material'
import { RoleEditorPage, RolesListPage, UserEditorPage, UsersListPage } from '../features/admin/AdminPanels'
import { NodeTypeEditorPage, NodeTypesListPage } from '../features/admin/NodeTypePages'
import { TeamEditorPage, TeamsListPage } from '../features/admin/TeamsPages'
import { ThemeEditorPage, ThemesListPage } from '../features/admin/ThemesPages'
import { AuditPage } from '../features/audit/AuditPanel'
import { IconsPage } from '../features/icons/IconsAdminPanel'
import LoginPage from '../features/login/LoginPage'
import { GameEditorPage, GameListPage } from '../features/scenario/GamePages'
import { ScenarioEditorPage, ScenarioListPage, ScenarioPreviewPage } from '../features/scenario/ScenarioPages'
import { useChrome } from '../features/session/useChrome'
import { useSessionStore } from '../features/session/useSessionStore'
import { ApplicationMenu } from '../shared/ui/ApplicationMenu'
import { MapToolbar, ShowMapTools } from '../shared/ui/MapToolbar'
import { MapStage } from '../shared/ui/MapStage'
import { StatusFooter } from '../shared/ui/StatusFooter'
import { ToolDock } from '../shared/ui/ToolDock'
import { ContextStrip, TopBar } from '../shared/ui/TopBar'
import { WorkWindow } from '../shared/ui/WorkWindow'

function Frame() {
  const { panel, closePanel, select } = useChrome()
  const refresh = useSessionStore((state) => state.refresh)
  const [toolsOpen, setToolsOpen] = useState(true)
  const [readout, setReadout] = useState(null)

  useEffect(() => {
    refresh().catch(() => {})
  }, [refresh])

  return (
    <Box sx={{ height: '100%', minHeight: 0, display: 'flex', flexDirection: 'column', bgcolor: 'background.default', color: 'text.primary' }}>
      <TopBar
        leading={
          <Box sx={{ display: 'flex', alignItems: 'center', minWidth: 0 }}>
            <ApplicationMenu presentation="menu" />
            <ShowMapTools pressed={toolsOpen} onClick={() => setToolsOpen((open) => !open)} />
          </Box>
        }
      />
      <ContextStrip />
      {toolsOpen ? <MapToolbar activeId={panel} onSelect={select} /> : null}
      <Box
        sx={{
          flex: 1,
          minWidth: 0,
          minHeight: 0,
          display: 'flex',
          flexDirection: { xs: 'column', md: 'row' },
          overflow: 'hidden',
        }}
      >
        <Box sx={{ flex: 1, minWidth: 0, minHeight: { xs: panel ? '32vh' : 0, md: 0 }, display: 'flex' }}>
          <MapStage readout="none" onReadout={setReadout} />
        </Box>
        <ToolDock panel={panel} onClose={closePanel} edge="end" />
      </Box>
      <StatusFooter readout={readout} />
    </Box>
  )
}

function Workspace() {
  return (
    <Box sx={{ height: '100%', minHeight: 0 }}>
      <Frame />
      <WorkWindow />
    </Box>
  )
}

export default function Shell() {
  const session = useSessionStore((state) => state.session)
  return (
    <Routes>
      <Route path="/login" element={session ? <Navigate to="/" replace /> : <LoginPage />} />
      <Route element={session ? <Workspace /> : <Navigate to="/login" replace />}>
        <Route path="/" element={null} />
        <Route path="/exercise/scenarios" element={<ScenarioListPage />} />
        <Route path="/exercise/scenarios/:id/preview" element={<ScenarioPreviewPage />} />
        <Route path="/exercise/scenarios/:id" element={<ScenarioEditorPage />} />
        <Route path="/exercise/games" element={<GameListPage />} />
        <Route path="/exercise/games/:id" element={<GameEditorPage />} />
        <Route path="/standard/teams" element={<TeamsListPage />} />
        <Route path="/standard/teams/:id" element={<TeamEditorPage />} />
        <Route path="/standard/themes" element={<ThemesListPage />} />
        <Route path="/standard/themes/:id" element={<ThemeEditorPage />} />
        <Route path="/standard/node-types" element={<NodeTypesListPage />} />
        <Route path="/standard/node-types/:id" element={<NodeTypeEditorPage />} />
        <Route path="/records/audit" element={<AuditPage />} />
        <Route path="/records/icons" element={<IconsPage />} />
        <Route path="/access/users" element={<UsersListPage />} />
        <Route path="/access/users/:id" element={<UserEditorPage />} />
        <Route path="/access/roles" element={<RolesListPage />} />
        <Route path="/access/roles/:id" element={<RoleEditorPage />} />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Route>
    </Routes>
  )
}
