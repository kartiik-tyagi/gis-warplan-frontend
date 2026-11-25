import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams, useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { del, get, post, put } from '../../shared/api/http'
import { loadMoonPhases } from '../../shared/api/moonPhases'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { logger } from '../../shared/lib/logger'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import { LoadingState } from '../../shared/ui/LoadingState'
import { RichTextEditor } from '../../shared/ui/richtext/RichTextEditor'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { ExerciseLayout } from './ExerciseLayout'

const EMPTY = {
  name: '',
  dateTime: '',
  sunrise: '',
  sunset: '',
  moonphases: '',
  description: '',
}

function toLocalInput(value) {
  if (!value) return ''
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return String(value).slice(0, 16)
  const pad = (n) => String(n).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function fromLocalInput(value) {
  if (!value) return null
  const date = new Date(value)
  return Number.isNaN(date.getTime()) ? null : date.toISOString().slice(0, 19)
}

function toTimeInput(value) {
  if (!value) return ''
  return String(value).slice(0, 5)
}

function fromTimeInput(value) {
  if (!value) return null
  return value.length === 5 ? `${value}:00` : value
}

function GameList() {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const push = useToastStore((state) => state.push)
  const changeGame = useSessionStore((state) => state.changeGame)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [scenarios, setScenarios] = useState(null)
  const [games, setGames] = useState(null)
  const [activatingId, setActivatingId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busyDelete, setBusyDelete] = useState(false)
  const scenarioId = searchParams.get('scenarioId') || ''

  useEffect(() => {
    let live = true
    get('/scenarios')
      .then(async (rows) => {
        if (!live) return
        const list = rows || EMPTY_LIST
        setScenarios(list)
        if (!scenarioId) {
          const preferred = list.find((row) => row.active) || list[0]
          if (preferred) setSearchParams({ scenarioId: String(preferred.id) }, { replace: true })
        }
        try {
          await refreshSession()
        } catch {
          // dropdown sync is best-effort
        }
      })
      .catch((error) => {
        if (!live) return
        setScenarios(EMPTY_LIST)
        push(error?.message || 'Scenarios could not be loaded.', 'error')
      })
    return () => {
      live = false
    }
  }, [push, scenarioId, setSearchParams, refreshSession])

  const loadGames = useCallback(async () => {
    if (!scenarioId) {
      setGames(EMPTY_LIST)
      return
    }
    try {
      setGames((await get(`/scenarios/${scenarioId}/games`)) || EMPTY_LIST)
    } catch (error) {
      setGames(EMPTY_LIST)
      push(error?.message || 'Games could not be loaded.', 'error')
    }
  }, [scenarioId, push])

  useEffect(() => {
    setGames(null)
    loadGames()
  }, [loadGames])

  const activate = async (event, item) => {
    event.preventDefault()
    event.stopPropagation()
    if (item.active || activatingId) return
    setActivatingId(item.id)
    try {
      await changeGame(String(item.id))
      push(`“${item.name}” is now the active game.`, 'success')
      await loadGames()
      await refreshSession()
    } catch (error) {
      push(error?.message || 'The game could not be activated.', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  const deactivate = async (event, item) => {
    event.preventDefault()
    event.stopPropagation()
    if (!item.active || activatingId) return
    setActivatingId(item.id)
    try {
      await changeGame('')
      push(`“${item.name}” is no longer the active game.`, 'success')
      await loadGames()
      await refreshSession()
    } catch (error) {
      push(error?.message || 'The game could not be deactivated.', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  if (!scenarios) return <LoadingState label="Loading scenarios" />

  return (
    <Stack spacing={2.5}>
      <SearchSelect
        label="Scenario"
        options={scenarios}
        value={scenarioId}
        onChange={(id) => setSearchParams(id ? { scenarioId: id } : {})}
        disabled={!scenarios.length}
        getOptionLabel={(item) => `${item.name}${item.active ? ' · Active' : ''}`}
        getOptionValue={(item) => String(item.id)}
        sx={{ width: '100%', maxWidth: { xs: '100%', md: '36rem' } }}
      />

      {!scenarios.length ? (
        <CreateAction label="Create Scenario" onClick={() => navigate('/exercise/scenarios/new')} />
      ) : !games ? (
        <LoadingState label="Loading Games" />
      ) : !games.length ? (
        <Box
          sx={{
            py: 6,
            px: 3,
            textAlign: 'center',
            border: 1,
            borderColor: 'divider',
            borderStyle: 'dashed',
            borderRadius: 2,
          }}
        >
          <Typography variant="h6" sx={{ mb: 2, color: 'text.primary' }}>
            No Games For This Scenario
          </Typography>
          <CreateAction
            label="New Game"
            onClick={() => navigate(`/exercise/games/new?scenarioId=${scenarioId}`)}
          />
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {games.map((item) => (
            <EntityCard
              key={item.id}
              title={item.name}
              active={Boolean(item.active)}
              actions={
                <>
                  <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/exercise/games/${item.id}`)} />
                  {item.active ? (
                    <IconAction label={activatingId === item.id ? 'Deactivating…' : 'Deactivate'} icon={<BlockOutlinedIcon fontSize="small" />} disabled={activatingId != null} onClick={(event) => deactivate(event, item)} />
                  ) : (
                    <IconAction label={activatingId === item.id ? 'Activating…' : 'Activate'} icon={<PlayArrowIcon fontSize="small" />} color="primary" disabled={activatingId != null} onClick={(event) => activate(event, item)} />
                  )}
                  <IconAction label="Delete" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={Boolean(item.active) || busyDelete} onClick={() => setDeleting(item)} />
                </>
              }
            />
          ))}
        </Stack>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete This Game?"
        message={deleting ? `“${deleting.name}” will be removed. The active game cannot be deleted.` : ''}
        confirmLabel="Delete"
        busy={busyDelete}
        onClose={() => { if (!busyDelete) setDeleting(null) }}
        onConfirm={async () => {
          if (!deleting) return
          setBusyDelete(true)
          try {
            await del(`/games/${deleting.id}`)
            push('Game deleted.', 'success')
            setDeleting(null)
            await loadGames()
            await refreshSession()
          } catch (error) {
            push(error?.message || 'The game could not be deleted.', 'error')
          } finally {
            setBusyDelete(false)
          }
        }}
      />
    </Stack>
  )
}

function GameEditor() {
  const { id } = useParams()
  const [searchParams] = useSearchParams()
  const isNew = id === 'new' || !id
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const changeGame = useSessionStore((state) => state.changeGame)
  const [scenarios, setScenarios] = useState(EMPTY_LIST)
  const [scenarioId, setScenarioId] = useState(searchParams.get('scenarioId') || '')
  const [form, setForm] = useState(EMPTY)
  const [active, setActive] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [phases, setPhases] = useState(EMPTY_LIST)

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
    let live = true
    get('/scenarios')
      .then((rows) => {
        if (!live) return
        const list = rows || EMPTY_LIST
        setScenarios(list)
        setScenarioId((current) => current || String((list.find((row) => row.active) || list[0])?.id || ''))
      })
      .catch(() => {
        if (live) setScenarios(EMPTY_LIST)
      })
    return () => {
      live = false
    }
  }, [])

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY)
      setActive(false)
      setReady(true)
      return
    }
    let live = true
    setReady(false)
    get(`/games/${id}`)
      .then((row) => {
        if (!live) return
        setScenarioId(String(row.scenarioId))
        setForm({
          name: row.name || '',
          dateTime: row.dateTime || '',
          sunrise: row.sunrise || '',
          sunset: row.sunset || '',
          moonphases: row.moonphases || '',
          description: row.description || '',
        })
        setActive(Boolean(row.active))
        setReady(true)
      })
      .catch((error) => {
        if (!live) return
        push(error?.message || 'Game not found.', 'error')
        navigate('/exercise/games', { replace: true })
      })
    return () => {
      live = false
    }
  }, [id, isNew, navigate, push])

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const body = useMemo(
    () => ({
      name: form.name.trim(),
      dateTime: fromLocalInput(form.dateTime),
      sunrise: fromTimeInput(form.sunrise),
      sunset: fromTimeInput(form.sunset),
      moonphases: form.moonphases || null,
      description: form.description || null,
      metadata: null,
    }),
    [form],
  )

  const save = async () => {
    if (!scenarioId) {
      setMessage('Choose a scenario for this game.')
      return
    }
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      if (isNew) {
        const created = await post(`/scenarios/${scenarioId}/games`, body)
        logger.info('game.created', { id: created.id, scenarioId })
        await refreshSession()
        push('Game created.', 'success')
        navigate(scenarioId ? `/exercise/games?scenarioId=${scenarioId}` : '/exercise/games', { replace: true })
      } else {
        await put(`/games/${id}`, body)
        logger.info('game.updated', { id })
        await refreshSession()
        push('Game saved.', 'success')
        navigate(scenarioId ? `/exercise/games?scenarioId=${scenarioId}` : '/exercise/games', { replace: true })
      }
    } catch (error) {
      setErrors(error?.fieldErrors || {})
      setMessage(error?.message || 'The game could not be saved.')
      push(error?.message || 'The game could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await del(`/games/${id}`)
      await refreshSession()
      push('Game deleted.', 'success')
      navigate(`/exercise/games?scenarioId=${scenarioId}`)
    } catch (error) {
      push(error?.message || 'The game could not be deleted.', 'error')
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  if (!ready) return <LoadingState label="Opening game" />

  return (
    <Stack spacing={2.5}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate(scenarioId ? `/exercise/games?scenarioId=${scenarioId}` : '/exercise/games')} disabled={busy} />
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <SearchSelect
          label="Scenario"
          options={scenarios}
          value={scenarioId}
          onChange={setScenarioId}
          disabled={!isNew || !scenarios.length}
          getOptionLabel={(item) => item.name}
          getOptionValue={(item) => String(item.id)}
          fullWidth={false}
          sx={{ flex: { xs: '1 1 100%', sm: '1 1 12rem' }, minWidth: { xs: '100%', sm: '12rem' }, maxWidth: '100%', width: 'auto' }}
        />
        <TextField
          label="Game Name"
          value={form.name}
          onChange={(event) => change('name', event.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name || undefined}
          required
          fullWidth
          sx={{ flex: 1.4 }}
        />
        {active ? <Chip color="success" label="Active" sx={{ alignSelf: { sm: 'center' } }} /> : null}
      </Stack>

      <TextField
        type="datetime-local"
        label="Date and Time"
        value={form.dateTime ? toLocalInput(form.dateTime) : ''}
        onChange={(event) => change('dateTime', event.target.value)}
        error={Boolean(errors.dateTime)}
        helperText={errors.dateTime || undefined}
        fullWidth
        slotProps={{
          inputLabel: { shrink: true },
          htmlInput: { placeholder: '' },
        }}
      />
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
        <TextField
          type="time"
          label="Sunrise"
          value={toTimeInput(form.sunrise)}
          onChange={(event) => change('sunrise', event.target.value)}
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { placeholder: '' },
          }}
        />
        <TextField
          type="time"
          label="Sunset"
          value={toTimeInput(form.sunset)}
          onChange={(event) => change('sunset', event.target.value)}
          fullWidth
          slotProps={{
            inputLabel: { shrink: true },
            htmlInput: { placeholder: '' },
          }}
        />
      </Stack>
      <SearchSelect
        label="Moon Phase"
        clearLabel="None"
        options={phases}
        value={form.moonphases}
        onChange={(id) => change('moonphases', id)}
        error={Boolean(errors.moonphases)}
        helperText={errors.moonphases || undefined}
        getOptionLabel={(phase) => phase.label}
        getOptionValue={(phase) => phase.code}
      />
      <RichTextEditor
        label="Description"
        value={form.description}
        onChange={(html) => change('description', html)}
        placeholder="Situation for this game…"
        error={Boolean(errors.description)}
        helperText={errors.description}
        minHeight={140}
      />

      <Stack direction="row" spacing={1} justifyContent="flex-end" flexWrap="wrap" useFlexGap>
        {!isNew ? (
          <IconAction label="Delete" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy || active} onClick={() => setConfirmDelete(true)} />
        ) : null}
        {!isNew && active ? (
          <IconAction label="Deactivate" icon={<BlockOutlinedIcon fontSize="small" />} disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              await changeGame('')
              setActive(false)
              push('This game is no longer active.', 'success')
            } catch (error) {
              push(error?.message || 'The game could not be deactivated.', 'error')
            } finally {
              setBusy(false)
            }
          }} />
        ) : null}
        {!isNew && !active ? (
          <IconAction label="Activate" icon={<PlayArrowIcon fontSize="small" />} disabled={busy} variant="contained" onClick={async () => {
            setBusy(true)
            try {
              await changeGame(String(id))
              setActive(true)
              push('This game is now active.', 'success')
            } catch (error) {
              push(error?.message || 'The game could not be activated.', 'error')
            } finally {
              setBusy(false)
            }
          }} />
        ) : null}
        <IconAction
          label={busy ? 'Saving…' : isNew ? 'Create Game' : 'Save Game'}
          icon={<SaveOutlinedIcon fontSize="small" />}
          onClick={save}
          disabled={busy || !form.name.trim()}
          variant="contained"
        />
      </Stack>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete This Game?"
        message="Playing ORBATs and alliances for this game are removed. The active game cannot be deleted."
        confirmLabel="Delete"
        busy={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </Stack>
  )
}

export function GameListPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const scenarioId = searchParams.get('scenarioId')
  return (
    <ExerciseLayout
      actions={
        <CreateAction
          label="New Game"
          disabled={!scenarioId}
          onClick={() => navigate(`/exercise/games/new${scenarioId ? `?scenarioId=${scenarioId}` : ''}`)}
        />
      }
    >
      <GameList />
    </ExerciseLayout>
  )
}

export function GameEditorPage() {
  return (
    <ExerciseLayout>
      <GameEditor />
    </ExerciseLayout>
  )
}
