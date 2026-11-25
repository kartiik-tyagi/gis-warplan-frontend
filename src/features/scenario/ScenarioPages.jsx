import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import BlockOutlinedIcon from '@mui/icons-material/BlockOutlined'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PlayArrowIcon from '@mui/icons-material/PlayArrow'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import SportsEsportsOutlinedIcon from '@mui/icons-material/SportsEsportsOutlined'
import VisibilityOutlinedIcon from '@mui/icons-material/VisibilityOutlined'
import { del, get, post, put } from '../../shared/api/http'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { logger } from '../../shared/lib/logger'
import { CollapsibleField } from '../../shared/ui/CollapsibleField'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import { LoadingState } from '../../shared/ui/LoadingState'
import { RichTextEditor } from '../../shared/ui/richtext/RichTextEditor'
import { RichTextView } from '../../shared/ui/richtext/RichTextView'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { ExerciseLayout } from './ExerciseLayout'
import { ScenarioAttachment, uploadAttachment } from './ScenarioAttachment'

const EMPTY = {
  name: '',
  generalIdea: '',
  openingNarrative: '',
  specialIdea: '',
}

function ScenarioList() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const changeScenario = useSessionStore((state) => state.changeScenario)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [items, setItems] = useState(null)
  const [activatingId, setActivatingId] = useState(null)
  const [deleting, setDeleting] = useState(null)
  const [busyDelete, setBusyDelete] = useState(false)

  const load = useCallback(async () => {
    try {
      const rows = (await get('/scenarios')) || EMPTY_LIST
      setItems(rows)
      await refreshSession()
    } catch (error) {
      setItems(EMPTY_LIST)
      push(error?.message || 'Scenarios could not be loaded.', 'error')
    }
  }, [push, refreshSession])

  useEffect(() => {
    load()
  }, [load])

  const activate = async (item) => {
    if (item.active || activatingId) return
    setActivatingId(item.id)
    try {
      await changeScenario(String(item.id))
      push(`“${item.name}” is now the active scenario.`, 'success')
      await load()
    } catch (error) {
      push(error?.message || 'The scenario could not be activated.', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  const deactivate = async (item) => {
    if (!item.active || activatingId) return
    setActivatingId(item.id)
    try {
      await changeScenario('')
      push(`“${item.name}” is no longer the active scenario.`, 'success')
      await load()
    } catch (error) {
      push(error?.message || 'The scenario could not be deactivated.', 'error')
    } finally {
      setActivatingId(null)
    }
  }

  const confirmDelete = async () => {
    if (!deleting) return
    setBusyDelete(true)
    try {
      await del(`/scenarios/${deleting.id}`)
      await refreshSession()
      push('Scenario deleted.', 'success')
      setDeleting(null)
      await load()
    } catch (error) {
      push(error?.message || 'The scenario could not be deleted.', 'error')
    } finally {
      setBusyDelete(false)
    }
  }

  if (!items) return <LoadingState label="Loading scenarios" />

  return (
    <Stack spacing={1.25}>
      {!items.length ? (
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
            No Scenarios Yet
          </Typography>
          <CreateAction label="New Scenario" onClick={() => navigate('/exercise/scenarios/new')} />
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {items.map((item) => (
            <EntityCard
              key={item.id}
              title={item.name}
              active={Boolean(item.active)}
              actions={
                <>
                  <IconAction label="Preview" icon={<VisibilityOutlinedIcon fontSize="small" />} onClick={() => navigate(`/exercise/scenarios/${item.id}/preview`)} />
                  <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/exercise/scenarios/${item.id}`)} />
                  <IconAction label="Manage Games" icon={<SportsEsportsOutlinedIcon fontSize="small" />} onClick={() => navigate(`/exercise/games?scenarioId=${item.id}`)} />
                  {item.active ? (
                    <IconAction label={activatingId === item.id ? 'Deactivating…' : 'Deactivate'} icon={<BlockOutlinedIcon fontSize="small" />} disabled={activatingId != null} onClick={() => deactivate(item)} />
                  ) : (
                    <IconAction label={activatingId === item.id ? 'Activating…' : 'Activate'} icon={<PlayArrowIcon fontSize="small" />} color="primary" disabled={activatingId != null} onClick={() => activate(item)} />
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
        title="Delete This Scenario?"
        message={
          deleting
            ? `“${deleting.name}” and its games will be removed. The active scenario cannot be deleted.`
            : ''
        }
        confirmLabel="Delete"
        busy={busyDelete}
        onClose={() => {
          if (!busyDelete) setDeleting(null)
        }}
        onConfirm={confirmDelete}
      />
    </Stack>
  )
}

function ScenarioPreview() {
  const { id } = useParams()
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [row, setRow] = useState(null)

  useEffect(() => {
    let live = true
    get(`/scenarios/${id}`)
      .then((data) => {
        if (live) setRow(data)
      })
      .catch((error) => {
        if (!live) return
        push(error?.message || 'Scenario not found.', 'error')
        navigate('/exercise/scenarios', { replace: true })
      })
    return () => {
      live = false
    }
  }, [id, navigate, push])

  if (!row) return <LoadingState label="Opening scenario" />

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} alignItems="center" useFlexGap flexWrap="wrap">
        <Typography variant="h5" sx={{ flex: 1, fontWeight: 600, color: 'text.primary' }}>
          {row.name}
        </Typography>
        {row.active ? <Chip color="success" label="Active Exercise" /> : null}
      </Stack>

      {[
        ['General Idea', row.generalIdea],
        ['Opening Narrative', row.openingNarrative],
        ['Special Idea', row.specialIdea],
      ].map(([label, html]) => (
        <CollapsibleField key={label} title={label} defaultOpen={false}>
          <RichTextView html={html} />
        </CollapsibleField>
      ))}

      <ScenarioAttachment scenarioId={id} fileName={row.attachedFile || ''} disabled />

      <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
        <IconAction label="Back To List" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/exercise/scenarios')} />
        <IconAction
          label="Manage Games"
          icon={<SportsEsportsOutlinedIcon fontSize="small" />}
          onClick={() => navigate(`/exercise/games?scenarioId=${id}`)}
        />
        <IconAction
          label="Edit"
          icon={<EditOutlinedIcon fontSize="small" />}
          onClick={() => navigate(`/exercise/scenarios/${id}`)}
          variant="contained"
        />
      </Stack>
    </Stack>
  )
}

function ScenarioEditor() {
  const { id } = useParams()
  const isNew = id === 'new' || !id
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const changeScenario = useSessionStore((state) => state.changeScenario)
  const [form, setForm] = useState(EMPTY)
  const [attachedFile, setAttachedFile] = useState('')
  const [pendingFile, setPendingFile] = useState(null)
  const [active, setActive] = useState(false)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(isNew)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isNew) {
      setForm(EMPTY)
      setAttachedFile('')
      setPendingFile(null)
      setActive(false)
      setReady(true)
      return
    }
    let live = true
    setReady(false)
    get(`/scenarios/${id}`)
      .then((row) => {
        if (!live) return
        setForm({
          name: row.name || '',
          generalIdea: row.generalIdea || '',
          openingNarrative: row.openingNarrative || '',
          specialIdea: row.specialIdea || '',
        })
        setAttachedFile(row.attachedFile || '')
        setActive(Boolean(row.active))
        setReady(true)
      })
      .catch((error) => {
        if (!live) return
        push(error?.message || 'Scenario not found.', 'error')
        navigate('/exercise/scenarios', { replace: true })
      })
    return () => {
      live = false
    }
  }, [id, isNew, navigate, push])

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const save = async () => {
    setBusy(true)
    setErrors({})
    setMessage('')
    const body = {
      name: form.name.trim(),
      generalIdea: form.generalIdea || null,
      openingNarrative: form.openingNarrative || null,
      specialIdea: form.specialIdea || null,
    }
    try {
      if (isNew) {
        const created = await post('/scenarios', body)
        logger.info('scenario.created', { id: created.id })
        if (pendingFile) {
          try {
            await uploadAttachment(created.id, pendingFile)
            logger.info('scenario.attachment.uploaded', { id: created.id, file: pendingFile.name })
          } catch (uploadError) {
            await refreshSession()
            push('Scenario created, but the attachment could not be uploaded.', 'warning')
            push(uploadError?.message || 'Attachment upload failed.', 'error')
            navigate('/exercise/scenarios', { replace: true })
            return
          }
        }
        await refreshSession()
        push(pendingFile ? 'Scenario created with attachment.' : 'Scenario created.', 'success')
        navigate('/exercise/scenarios', { replace: true })
      } else {
        await put(`/scenarios/${id}`, body)
        logger.info('scenario.updated', { id })
        await refreshSession()
        push('Scenario saved.', 'success')
        navigate('/exercise/scenarios', { replace: true })
      }
    } catch (error) {
      setErrors(error?.fieldErrors || {})
      setMessage(error?.message || 'The scenario could not be saved.')
      push(error?.message || 'The scenario could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await del(`/scenarios/${id}`)
      await refreshSession()
      push('Scenario deleted.', 'success')
      navigate('/exercise/scenarios')
    } catch (error) {
      push(error?.message || 'The scenario could not be deleted.', 'error')
    } finally {
      setBusy(false)
      setConfirmDelete(false)
    }
  }

  if (!ready) return <LoadingState label="Opening scenario" />

  return (
    <Stack spacing={2.5}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/exercise/scenarios')} disabled={busy} />
      </Box>
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} alignItems={{ sm: 'center' }}>
        <TextField
          label="Scenario Name"
          value={form.name}
          onChange={(event) => change('name', event.target.value)}
          error={Boolean(errors.name)}
          helperText={errors.name || undefined}
          fullWidth
          required
          sx={{ flex: 1 }}
        />
        {active ? <Chip color="success" label="Active Exercise" /> : null}
      </Stack>

      <CollapsibleField title="General Idea" defaultOpen={false} error={Boolean(errors.generalIdea)}>
        <RichTextEditor
          label=""
          value={form.generalIdea}
          onChange={(html) => change('generalIdea', html)}
          placeholder="Strategic intent for this scenario…"
          error={Boolean(errors.generalIdea)}
          helperText={errors.generalIdea}
          minHeight={120}
        />
      </CollapsibleField>
      <CollapsibleField title="Opening Narrative" defaultOpen={false} error={Boolean(errors.openingNarrative)}>
        <RichTextEditor
          label=""
          value={form.openingNarrative}
          onChange={(html) => change('openingNarrative', html)}
          placeholder="How the exercise begins…"
          error={Boolean(errors.openingNarrative)}
          helperText={errors.openingNarrative}
          minHeight={140}
        />
      </CollapsibleField>
      <CollapsibleField title="Special Idea" defaultOpen={false} error={Boolean(errors.specialIdea)}>
        <RichTextEditor
          label=""
          value={form.specialIdea}
          onChange={(html) => change('specialIdea', html)}
          placeholder="Constraints, surprises, and special instructions…"
          error={Boolean(errors.specialIdea)}
          helperText={errors.specialIdea}
          minHeight={120}
        />
      </CollapsibleField>
      <ScenarioAttachment
        scenarioId={isNew ? null : id}
        fileName={attachedFile}
        pendingFile={isNew ? pendingFile : null}
        onPendingChange={isNew ? setPendingFile : undefined}
        disabled={busy}
        onChanged={(name) => setAttachedFile(name || '')}
      />

      <Stack direction="row" spacing={1} justifyContent="flex-end" useFlexGap flexWrap="wrap">
        {!isNew ? (
          <IconAction label="Delete" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy || active} onClick={() => setConfirmDelete(true)} />
        ) : null}
        {!isNew && active ? (
          <IconAction label="Deactivate" icon={<BlockOutlinedIcon fontSize="small" />} disabled={busy} onClick={async () => {
            setBusy(true)
            try {
              await changeScenario('')
              setActive(false)
              push('This scenario is no longer active.', 'success')
            } catch (error) {
              push(error?.message || 'The scenario could not be deactivated.', 'error')
            } finally {
              setBusy(false)
            }
          }} />
        ) : null}
        {!isNew && !active ? (
          <IconAction label="Activate" icon={<PlayArrowIcon fontSize="small" />} disabled={busy} variant="contained" onClick={async () => {
            setBusy(true)
            try {
              await changeScenario(String(id))
              setActive(true)
              push('This scenario is now active.', 'success')
            } catch (error) {
              push(error?.message || 'The scenario could not be activated.', 'error')
            } finally {
              setBusy(false)
            }
          }} />
        ) : null}
        <IconAction
          label={busy ? 'Saving…' : isNew ? 'Create Scenario' : 'Save Scenario'}
          icon={<SaveOutlinedIcon fontSize="small" />}
          onClick={save}
          disabled={busy || !form.name.trim()}
          variant="contained"
        />
      </Stack>

      <ConfirmDialog
        open={confirmDelete}
        title="Delete This Scenario?"
        message="Games and playing forces under it are removed. The active scenario cannot be deleted."
        confirmLabel="Delete"
        busy={busy}
        onClose={() => setConfirmDelete(false)}
        onConfirm={remove}
      />
    </Stack>
  )
}

export function ScenarioListPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout
      actions={<CreateAction label="New Scenario" onClick={() => navigate('/exercise/scenarios/new')} />}
    >
      <ScenarioList />
    </ExerciseLayout>
  )
}

export function ScenarioPreviewPage() {
  return (
    <ExerciseLayout>
      <ScenarioPreview />
    </ExerciseLayout>
  )
}

export function ScenarioEditorPage() {
  return (
    <ExerciseLayout>
      <ScenarioEditor />
    </ExerciseLayout>
  )
}
