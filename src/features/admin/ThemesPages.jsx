import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Checkbox,
  Chip,
  FormControlLabel,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import { titleCase } from '../../shared/lib/titleCase'
import { del, get, post, put } from '../../shared/api/http'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { logger } from '../../shared/lib/logger'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { LoadingState } from '../../shared/ui/LoadingState'
import { ExerciseLayout } from '../scenario/ExerciseLayout'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { asTheme, holderLabel } from './themeChoices'

function ThemesList() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [rows, setRows] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busyDelete, setBusyDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      setRows(((await get('/themes')) || EMPTY_LIST).map(asTheme))
    } catch (error) {
      setRows(EMPTY_LIST)
      push(error?.message || 'Themes could not be loaded.', 'error')
    }
  }, [push])

  useEffect(() => {
    load()
  }, [load])

  const confirmDelete = async () => {
    if (!deleting) return
    setBusyDelete(true)
    try {
      await del(`/themes/${deleting.id}`)
      push('Theme removed.', 'success')
      setDeleting(null)
      await load()
    } catch (error) {
      push(error?.message || 'The theme could not be removed.', 'error')
    } finally {
      setBusyDelete(false)
    }
  }

  if (!rows) return <LoadingState label="Loading themes" />

  return (
    <Stack spacing={1.25}>
      {!rows.length ? (
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
            No Themes Yet
          </Typography>
          <CreateAction label="New Theme" onClick={() => navigate('/standard/themes/new')} />
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {rows.map((row) => (
            <EntityCard
              key={row.id}
              title={row.name}
              chip={
                <Stack direction="row" spacing={0.5}>
                  {row.defaultTheme ? <Chip size="small" color="primary" label="Default" /> : null}
                  <Chip size="small" variant="outlined" label={titleCase(holderLabel(row))} />
                </Stack>
              }
              meta={row.description || '—'}
              actions={
                <>
                  <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/standard/themes/${row.id}`)} />
                  <IconAction label="Remove" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busyDelete || row.holderKind !== 'FREE'} onClick={() => setDeleting(row)} />
                </>
              }
            />
          ))}
        </Stack>
      )}

      <ConfirmDialog
        open={Boolean(deleting)}
        title="Remove Theme"
        message={deleting ? `Remove “${deleting.name}”? Only free themes can be removed.` : ''}
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

function ThemeEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [ready, setReady] = useState(false)
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState('')
  const [deleting, setDeleting] = useState(false)
  const [busyDelete, setBusyDelete] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [defaultTheme, setDefaultTheme] = useState(false)
  const [configJson, setConfigJson] = useState(null)
  const [holderKind, setHolderKind] = useState('FREE')
  const [holderChip, setHolderChip] = useState('Free')

  useEffect(() => {
    let live = true
    ;(async () => {
      try {
        if (isNew) {
          setReady(true)
          return
        }
        const row = asTheme(await get(`/themes/${id}`))
        if (!live) return
        setName(row.name || '')
        setDescription(row.description || '')
        setDefaultTheme(Boolean(row.defaultTheme))
        setConfigJson(row.configJson)
        setHolderKind(row.holderKind || 'FREE')
        setHolderChip(holderLabel(row))
        setReady(true)
      } catch (error) {
        if (!live) return
        push(error?.message || 'The theme could not be opened.', 'error')
        navigate('/standard/themes', { replace: true })
      }
    })()
    return () => {
      live = false
    }
  }, [id, isNew, navigate, push])

  const save = async () => {
    if (!name.trim()) return
    setBusy(true)
    setMessage('')
    try {
      const body = {
        name: name.trim(),
        description: description || '',
        defaultTheme: Boolean(defaultTheme),
        configJson,
      }
      if (isNew) {
        const created = await post('/themes', body)
        logger.info('theme.created', { id: created.id, name: body.name })
        push('Theme created. Allot it from Sides or Users.', 'success')
        await refreshSession().catch(() => {})
        navigate('/standard/themes', { replace: true })
      } else {
        await put(`/themes/${id}`, body)
        logger.info('theme.updated', { id })
        push('Theme saved.', 'success')
        await refreshSession().catch(() => {})
        navigate('/standard/themes', { replace: true })
      }
    } catch (error) {
      setMessage(error?.message || 'The theme could not be saved.')
      push(error?.message || 'The theme could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const confirmDelete = async () => {
    setBusyDelete(true)
    try {
      await del(`/themes/${id}`)
      push('Theme removed.', 'success')
      await refreshSession().catch(() => {})
      navigate('/standard/themes')
    } catch (error) {
      push(error?.message || 'The theme could not be removed.', 'error')
      setDeleting(false)
    } finally {
      setBusyDelete(false)
    }
  }

  if (!ready) return <LoadingState label="Opening theme" />

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 560 }}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/standard/themes')} disabled={busy || busyDelete} />
      </Box>
      {!isNew ? (
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
          <Chip size="small" variant="outlined" label={holderChip} />
          {defaultTheme ? <Chip size="small" color="primary" label="Default" /> : null}
        </Stack>
      ) : null}
      <TextField label="Theme Name" value={name} onChange={(event) => setName(event.target.value)} fullWidth required />
      <TextField
        label="Description"
        value={description}
        onChange={(event) => setDescription(event.target.value)}
        fullWidth
        multiline
        minRows={2}
      />
      <FormControlLabel
        control={<Checkbox checked={defaultTheme} onChange={(event) => setDefaultTheme(event.target.checked)} />}
        label="Default Theme"
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <IconAction
          label={busy ? 'Saving…' : isNew ? 'Create Theme' : 'Save Theme'}
          icon={<SaveOutlinedIcon fontSize="small" />}
          disabled={busy || busyDelete || !name.trim()}
          onClick={save}
          variant="contained"
        />
        {!isNew ? (
          <IconAction label="Remove" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy || busyDelete || holderKind !== 'FREE'} onClick={() => setDeleting(true)} />
        ) : null}
      </Stack>
      <ConfirmDialog
        open={deleting}
        title="Remove Theme"
        message="Remove this theme? Only free themes can be removed."
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

export function ThemesListPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout actions={<CreateAction label="New Theme" onClick={() => navigate('/standard/themes/new')} />}>
      <ThemesList />
    </ExerciseLayout>
  )
}

export function ThemeEditorPage() {
  return (
    <ExerciseLayout>
      <ThemeEditor />
    </ExerciseLayout>
  )
}
