import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import FlagOutlinedIcon from '@mui/icons-material/FlagOutlined'
import NightlightOutlinedIcon from '@mui/icons-material/NightlightOutlined'
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined'
import { useSessionStore } from '../../features/session/useSessionStore'
import { SearchSelect } from './SearchSelect'
import { loadMoonPhases, moonPhaseLabel } from '../api/moonPhases'

function Mark({ label, children }) {
  return (
    <Tooltip title={label}>
      <Box component="span" sx={{ display: 'inline-flex', color: 'text.secondary', flexShrink: 0 }} aria-hidden>
        {children}
      </Box>
    </Tooltip>
  )
}

function Fact({ label, icon, children, grow = false }) {
  return (
    <Box
      sx={{
        minWidth: grow ? { xs: '100%', lg: 0 } : 0,
        flex: grow ? { xs: '1 1 100%', lg: '1 1 0' } : '0 1 auto',
        maxWidth: '100%',
        display: 'flex',
        alignItems: 'center',
        gap: 0.75,
      }}
    >
      <Mark label={label}>{icon}</Mark>
      {children}
    </Box>
  )
}

/** Bar field that fills its share of the row and shrinks with the screen. */
function barField() {
  return {
    flex: '1 1 auto',
    minWidth: 0,
    width: 'auto',
    maxWidth: '100%',
    '& .MuiFormControl-root, & .MuiOutlinedInput-root': { width: '100%' },
    '& .MuiOutlinedInput-root': {
      height: 32,
      minHeight: 32,
      pl: 1,
      pr: '30px !important',
      fontSize: 13,
      bgcolor: 'background.paper',
    },
    '& .MuiOutlinedInput-input, & .MuiAutocomplete-input': {
      py: '0 !important',
      minWidth: '0 !important',
      textOverflow: 'ellipsis',
    },
    '& .MuiAutocomplete-endAdornment': { right: 4 },
  }
}

export function ScenarioContext() {
  const navigate = useNavigate()
  const session = useSessionStore((state) => state.session)
  const changeScenario = useSessionStore((state) => state.changeScenario)
  const changeGame = useSessionStore((state) => state.changeGame)
  const refresh = useSessionStore((state) => state.refresh)
  const [pending, setPending] = useState(null)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const [phases, setPhases] = useState([])

  useEffect(() => {
    let live = true
    loadMoonPhases()
      .then((rows) => {
        if (live) setPhases(rows)
      })
      .catch(() => {})
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (!session) return undefined
    let live = true
    refresh().catch(() => {
      if (!live) return
    })
    return () => {
      live = false
    }
  }, [refresh, session?.profile?.id])

  if (!session) return null

  const scenarios = session.scenarios || []
  const games = (session.games || []).filter(
    (item) => !session.activeScenarioId || item.scenarioId === session.activeScenarioId,
  )
  const scenario = scenarios.find((item) => item.id === session.activeScenarioId)
  const game = games.find((item) => item.id === session.activeGame.id) || session.activeGame
  const moonLabel = moonPhaseLabel(phases, game?.moonphases)
  function askScenario(id) {
    if (busy) return
    if (!id) {
      if (!session.activeScenarioId) return
      setError('')
      setPending({
        kind: 'scenario',
        id: '',
        name: 'No active scenario',
        from: scenario?.name || 'the current scenario',
        clearing: true,
      })
      return
    }
    if (id === session.activeScenarioId) return
    const next = scenarios.find((item) => item.id === id)
    if (!next) return
    setError('')
    setPending({ kind: 'scenario', id, name: next.name, from: scenario?.name || 'none' })
  }

  function askGame(id) {
    if (busy) return
    if (!id) {
      if (!session.activeGame?.id) return
      setError('')
      setPending({
        kind: 'game',
        id: '',
        name: 'No active game',
        from: game?.name || 'the current game',
        clearing: true,
      })
      return
    }
    if (!id || id === session.activeGame.id) return
    const next = games.find((item) => item.id === id)
    if (!next || !next.open) return
    setError('')
    setPending({ kind: 'game', id, name: next.name, from: game?.name || 'the current game' })
  }

  function close() {
    if (busy) return
    setPending(null)
    setError('')
  }

  async function confirm() {
    if (!pending) return
    setBusy(true)
    setError('')
    try {
      if (pending.kind === 'scenario') await changeScenario(pending.id)
      else await changeGame(pending.id)
      setPending(null)
    } catch (failure) {
      setError(failure?.message || 'The change could not be made.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', minWidth: 0, width: '100%' }}>
        {session.canSelectScenario ? (
          <Fact grow label="Scenario" icon={<FlagOutlinedIcon fontSize="small" />}>
            <SearchSelect
              size="small"
              hiddenLabel
              aria-label="Scenario"
              clearLabel="No active scenario"
              disableClearable
              fullWidth={false}
              placeholder=""
              options={scenarios}
              value={session.activeScenarioId || ''}
              disabled={busy}
              onChange={askScenario}
              getOptionLabel={(item) => `${item.name}${item.active || item.id === session.activeScenarioId ? ' · active' : ''}`}
              getOptionValue={(item) => item.id}
              sx={barField()}
            />
            <Button size="small" startIcon={<AddIcon />} onClick={() => navigate('/exercise/scenarios/new')} disabled={busy} sx={{ flexShrink: 0 }}>
              Add
            </Button>
          </Fact>
        ) : (
          <Fact label="Scenario" icon={<FlagOutlinedIcon fontSize="small" />}>
            <Typography variant="body2" noWrap color={scenario?.name ? 'text.primary' : 'text.secondary'}>
              {scenario?.name || 'None active'}
            </Typography>
          </Fact>
        )}
        {session.canSelectGame ? (
          <Fact grow label="Game" icon={<SportsEsportsOutlinedIcon fontSize="small" />}>
            <SearchSelect
              size="small"
              hiddenLabel
              aria-label="Game"
              clearLabel={session.activeScenarioId ? 'No active game' : undefined}
              disableClearable
              fullWidth={false}
              placeholder={session.activeScenarioId ? '' : 'Select a scenario first'}
              options={session.activeScenarioId ? games : []}
              value={session.activeScenarioId && session.activeGame.id && games.some((item) => item.id === session.activeGame.id) ? session.activeGame.id : ''}
              disabled={busy || !session.activeScenarioId}
              onChange={askGame}
              isOptionDisabled={(item) => item.open === false}
              getOptionLabel={(item) => `${item.open === false ? `${item.name} · Closed` : item.name}${item.active || item.id === session.activeGame.id ? ' · active' : ''}`}
              getOptionValue={(item) => item.id}
              sx={barField()}
            />
            {session.activeScenarioId ? (
              <Button
                size="small"
                startIcon={<AddIcon />}
                disabled={busy}
                onClick={() => navigate(`/exercise/games/new?scenarioId=${session.activeScenarioId}`)}
                sx={{ flexShrink: 0 }}
              >
                Add
              </Button>
            ) : null}
          </Fact>
        ) : (
          <Fact label="Game" icon={<SportsEsportsOutlinedIcon fontSize="small" />}>
            <Typography variant="body2" noWrap color={session.activeGame.name ? 'text.primary' : 'text.secondary'}>
              {session.activeGame.name || 'None active'}
            </Typography>
          </Fact>
        )}
        {game?.dateTime ? (
          <Fact label="Game Time" icon={<SportsEsportsOutlinedIcon fontSize="small" />}>
            <Typography variant="body2" noWrap sx={{ maxWidth: '100%' }}>
              {new Date(game.dateTime).toLocaleString()}
            </Typography>
          </Fact>
        ) : null}
        {moonLabel ? (
          <Fact label="Moon Phase" icon={<NightlightOutlinedIcon fontSize="small" />}>
            <Typography variant="body2" noWrap sx={{ maxWidth: '100%' }} title={moonLabel}>
              {moonLabel}
            </Typography>
          </Fact>
        ) : null}
      </Stack>
      <Dialog open={Boolean(pending)} onClose={close} fullWidth maxWidth="xs">
        <DialogTitle>
          {pending?.clearing
            ? pending?.kind === 'game'
              ? 'Clear the active game'
              : 'Clear the active scenario'
            : pending?.kind === 'game'
              ? 'Activate game'
              : 'Activate scenario'}
        </DialogTitle>
        <DialogContent>
          <Typography variant="body2" color="text.primary">
            {pending?.clearing && pending?.kind === 'scenario'
              ? 'Clear the active scenario and game? The exercise will have no open scenario until you choose one again.'
              : pending?.clearing && pending?.kind === 'game'
                ? 'Clear the active game? The scenario stays active until you choose a game again.'
                : pending
                  ? `Set ${pending.kind} to ${pending.name}? This becomes the open exercise.`
                  : ''}
          </Typography>
          {error ? (
            <Alert severity="error" sx={{ mt: 2 }}>
              {error}
            </Alert>
          ) : null}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={close} disabled={busy}>
            Cancel
          </Button>
          <Button variant="contained" onClick={confirm} disabled={busy || !pending}>
            {busy ? 'Working…' : pending?.clearing ? 'Clear' : 'Activate'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  )
}
