import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { del, get, post, put } from '../../shared/api/http'
import { swatchForColour } from '../../shared/api/mappers'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { logger } from '../../shared/lib/logger'
import { swatches } from '../../shared/theme/swatches'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { IconField, IconPreview } from '../../shared/ui/IconPicker'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { LoadingState } from '../../shared/ui/LoadingState'
import { ExerciseLayout } from '../scenario/ExerciseLayout'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { asTheme, selectableThemes } from './themeChoices'

function ThemeField({ themes, value, onChange, holderKind, holderId }) {
  const options = selectableThemes(themes, holderKind, holderId)
  return (
    <SearchSelect
      required
      label="Theme"
      options={options}
      value={value}
      onChange={onChange}
      getOptionLabel={(theme) => theme.name}
      getOptionValue={(theme) => String(theme.id)}
    />
  )
}

function ColourField({ value, onChange, allowCustom, customLabel }) {
  const options = allowCustom && value === 'custom' ? [{ id: 'custom', name: customLabel || 'Current colour' }, ...swatches] : swatches
  return (
    <SearchSelect
      label="Map Colour"
      options={options}
      value={value}
      onChange={onChange}
      getOptionLabel={(swatch) => swatch.name}
      getOptionValue={(swatch) => swatch.id}
    />
  )
}

function themeName(themes, themeId) {
  const found = themes.find((theme) => String(theme.id) === String(themeId))
  return found?.name || '—'
}

function TeamsList() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [sides, setSides] = useState(null)
  const [themes, setThemes] = useState(EMPTY_LIST)
  const [deleting, setDeleting] = useState(null)
  const [busyDelete, setBusyDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const [sideRows, themeRows] = await Promise.all([get('/sides'), get('/themes')])
      setSides(sideRows || EMPTY_LIST)
      setThemes((themeRows || EMPTY_LIST).map(asTheme))
    } catch (error) {
      setSides(EMPTY_LIST)
      push(error?.message || 'Sides could not be loaded.', 'error')
    }
  }, [push])

  useEffect(() => {
    load()
  }, [load])

  const confirmDelete = async () => {
    if (!deleting) return
    setBusyDelete(true)
    try {
      await del(`/sides/${deleting.id}`)
      push('Side removed.', 'success')
      setDeleting(null)
      await load()
    } catch (error) {
      push(error?.message || 'The side could not be removed.', 'error')
    } finally {
      setBusyDelete(false)
    }
  }

  if (!sides) return <LoadingState label="Loading sides" />

  const countries = sides.filter((side) => side.kind !== 'alliance')
  const alliances = sides.filter((side) => side.kind === 'alliance')

  return (
    <Stack spacing={1.25}>
      {!countries.length ? (
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
          <Typography variant="h6" sx={{ mb: 2 }}>
            No Sides Yet
          </Typography>
          <CreateAction label="New Side" onClick={() => navigate('/standard/teams/new')} />
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {countries.map((side) => (
            <EntityCard
              key={side.id}
              title={side.name}
              leading={
                <Stack direction="row" spacing={0.75} alignItems="center">
                  <Box
                    sx={{
                      width: 14,
                      height: 14,
                      borderRadius: '50%',
                      bgcolor: side.colour || 'text.disabled',
                      border: 1,
                      borderColor: 'divider',
                      flexShrink: 0,
                    }}
                  />
                  {side.icon ? <IconPreview path={side.icon} size={18} /> : null}
                </Stack>
              }
              chip={<Chip size="small" label={themeName(themes, side.themeId)} variant="outlined" />}
              meta="—"
              actions={
                <>
                  <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/standard/teams/${side.id}`)} />
                  <IconAction label="Remove" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busyDelete} onClick={() => setDeleting(side)} />
                </>
              }
            />
          ))}
        </Stack>
      )}

      {alliances.length ? (
        <Box sx={{ pt: 1 }}>
          <Typography variant="subtitle2" sx={{ mb: 1 }}>
            Alliances
          </Typography>
          <Stack spacing={0.5}>
            {alliances.map((side) => (
              <Typography key={side.id} variant="body2">
                {side.name}
              </Typography>
            ))}
          </Stack>
        </Box>
      ) : null}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove Side"
        message={
          deleting
            ? `Remove “${deleting.name}”? This also removes its standard ORBAT when nobody is marked on it.`
            : ''
        }
        confirmLabel="Remove"
        busy={busyDelete}
        onClose={() => {
          if (!busyDelete) setDeleting(null)
        }}
        onConfirm={confirmDelete}
      />
    </Stack>
  )
}

function TeamEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [themes, setThemes] = useState(EMPTY_LIST)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [busyDelete, setBusyDelete] = useState(false)
  const [name, setName] = useState('')
  const [swatchId, setSwatchId] = useState('blue')
  const [customColour, setCustomColour] = useState('')
  const [icon, setIcon] = useState('')
  const [themeId, setThemeId] = useState('')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        const themeRows = ((await get('/themes')) || EMPTY_LIST).map(asTheme)
        if (!live) return
        setThemes(themeRows)
        if (isNew) {
          setReady(true)
          return
        }
        const side = await get(`/sides/${id}`)
        if (!live) return
        if (!side || side.kind === 'alliance') {
          push('That side was not found.', 'error')
          navigate('/standard/teams', { replace: true })
          return
        }
        setName(side.name || '')
        const match = swatchForColour(side.colour)
        setSwatchId(match?.id || 'custom')
        setCustomColour(side.colour || '')
        setIcon(side.icon || '')
        setThemeId(side.themeId == null ? '' : String(side.themeId))
        setReady(true)
      } catch (error) {
        if (!live) return
        push(error?.message || 'The side could not be opened.', 'error')
        navigate('/standard/teams', { replace: true })
      }
    })()
    return () => {
      live = false
    }
  }, [id, isNew, navigate, push])

  const save = async () => {
    if (!name.trim() || !themeId) return
    setBusy(true)
    setMessage('')
    try {
      const colour =
        swatchId === 'custom' ? customColour || '#2f6fed' : swatches.find((item) => item.id === swatchId)?.color || '#2f6fed'
      const body = {
        name: name.trim(),
        description: '',
        colour,
        icon: icon || null,
        themeId: Number(themeId),
      }
      if (isNew) {
        const created = await post('/sides', body)
        logger.info('team.created', { id: created.id, name: body.name })
        push('Side created. Its standard ORBAT root is ready.', 'success')
        await refreshSession().catch(() => {})
        navigate(`/standard/teams/${created.id}`, { replace: true })
      } else {
        await put(`/sides/${id}`, body)
        logger.info('team.updated', { id })
        push('Side saved.', 'success')
        await refreshSession().catch(() => {})
      }
    } catch (error) {
      setMessage(error?.message || 'The side could not be saved.')
      push(error?.message || 'The side could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    setBusyDelete(true)
    try {
      await del(`/sides/${id}`)
      push('Side removed.', 'success')
      await refreshSession().catch(() => {})
      navigate('/standard/teams')
    } catch (error) {
      push(error?.message || 'The side could not be removed.', 'error')
      setDeleting(false)
    } finally {
      setBusyDelete(false)
    }
  }

  if (!ready) return <LoadingState label="Opening side" />

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} fullWidth required />
      <ColourField
        value={swatchId}
        onChange={setSwatchId}
        allowCustom={!isNew}
        customLabel={customColour || 'Current colour'}
      />
      <IconField value={icon} onChange={setIcon} />
      <ThemeField
        themes={themes}
        value={themeId}
        onChange={setThemeId}
        holderKind="SIDE"
        holderId={isNew ? undefined : id}
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button onClick={() => navigate('/standard/teams')} disabled={busy || busyDelete}>
          Back To List
        </Button>
        <Button
          variant="contained"
          startIcon={<SaveOutlinedIcon />}
          disabled={busy || busyDelete || !name.trim() || !themeId}
          onClick={save}
        >
          {busy ? 'Saving…' : isNew ? 'Create Side' : 'Save Side'}
        </Button>
        {!isNew ? (
          <Button color="error" startIcon={<DeleteOutlinedIcon />} disabled={busy || busyDelete} onClick={() => setDeleting(true)}>
            Remove
          </Button>
        ) : null}
      </Stack>
      <ConfirmDialog
        open={deleting}
        title="Remove Side"
        message="Remove this side? This also removes its standard ORBAT when nobody is marked on it."
        confirmLabel="Remove"
        busy={busyDelete}
        onClose={() => {
          if (!busyDelete) setDeleting(false)
        }}
        onConfirm={confirmDelete}
      />
    </Stack>
  )
}

export function TeamsListPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout actions={<CreateAction label="New Side" onClick={() => navigate('/standard/teams/new')} />}>
      <TeamsList />
    </ExerciseLayout>
  )
}

export function TeamEditorPage() {
  return (
    <ExerciseLayout>
      <TeamEditor />
    </ExerciseLayout>
  )
}
