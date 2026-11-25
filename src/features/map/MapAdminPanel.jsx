import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Divider,
  FormControlLabel,
  Stack,
  Switch,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { CollapsibleField } from '../../shared/ui/CollapsibleField'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import { locationStartAdornment, useSharedMapPick } from '../../shared/map/PickOnMap'
import { del, get, post, put } from '../../shared/api/http'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { logger } from '../../shared/lib/logger'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { LoadingState } from '../../shared/ui/LoadingState'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { ExerciseLayout } from '../scenario/ExerciseLayout'

const EMPTY_SERVER = { code: '', name: '', wmsUrl: '', wfsUrl: '', restUrl: '', workspaceDefault: '', enabled: true, defaultServer: false }
const EMPTY_LAYER = {
  gisServerId: '', code: '', label: '', groupName: '', wmsLayers: '', format: 'image/png', transparent: true, baseLayer: false,
  sortOrder: 0, defaultVisible: false, defaultOpacity: 1, minZoom: '', maxZoom: '', cqlFilter: '', attribution: '', active: true,
}
const EMPTY_VIEW = {
  centerLon: 0, centerLat: 0, zoom: 4, minZoom: 0, maxZoom: 19, defaultGisServerId: '',
  dataCrs: 'EPSG:4326', viewCrs: 'EPSG:3857', elevationLayerId: '', elevationAttribute: '', elevationPositiveUp: true,
}

const SERVER_TEXT = [['code', 'Code'], ['name', 'Name'], ['wmsUrl', 'WMS URL'], ['wfsUrl', 'WFS URL'], ['restUrl', 'REST URL'], ['workspaceDefault', 'Default workspace']]
const LAYER_TEXT = [['code', 'Code'], ['label', 'Label'], ['groupName', 'Group'], ['wmsLayers', 'WMS layers'], ['format', 'Format'], ['cqlFilter', 'CQL filter'], ['attribution', 'Attribution']]
const LAYER_NUMBER = [['sortOrder', 'Sort order'], ['defaultOpacity', 'Default opacity (0-1)'], ['minZoom', 'Min zoom'], ['maxZoom', 'Max zoom']]
const LAYER_FLAGS = [['transparent', 'Transparent'], ['baseLayer', 'Base layer'], ['defaultVisible', 'Visible by default'], ['active', 'Active']]
const VIEW_NUMBER = [['centerLon', 'Center Long'], ['centerLat', 'Center Lat'], ['zoom', 'Zoom'], ['minZoom', 'Min Zoom'], ['maxZoom', 'Max Zoom']]

const toNumber = (value) => (value === '' || value === null || value === undefined || Number.isNaN(Number(value)) ? null : Number(value))
const orEmpty = (record, fallback) => {
  const next = { ...fallback }
  Object.keys(fallback).forEach((key) => {
    if (record?.[key] !== undefined && record?.[key] !== null) next[key] = record[key]
  })
  return next
}

function Field({ name, label, form, errors, onChange, ...rest }) {
  return (
    <TextField
      size="small"
      fullWidth
      label={label}
      value={form[name] ?? ''}
      onChange={(event) => onChange(name, event.target.value)}
      error={Boolean(errors[name])}
      helperText={errors[name] || undefined}
      {...rest}
    />
  )
}

function Flag({ name, label, form, onChange }) {
  return (
    <FormControlLabel
      label={<Typography variant="body2">{label}</Typography>}
      control={<Switch size="small" checked={Boolean(form[name])} onChange={(event) => onChange(name, event.target.checked)} />}
      sx={{ mr: 2, ml: 0 }}
    />
  )
}

function SectionLabel({ children }) {
  return (
    <Typography
      variant="overline"
      color="text.secondary"
      sx={{ letterSpacing: '0.1em', display: 'block', mb: 1, mt: 0.5 }}
    >
      {children}
    </Typography>
  )
}

function layerGroups(items) {
  const buckets = new Map()
  items.forEach((item) => {
    const name = String(item.groupName || '').trim() || 'Ungrouped'
    if (!buckets.has(name)) buckets.set(name, [])
    buckets.get(name).push(item)
  })
  for (const rows of buckets.values()) {
    rows.sort((left, right) => (left.sortOrder ?? 0) - (right.sortOrder ?? 0) || String(left.label || left.code).localeCompare(String(right.label || right.code)))
  }
  return [...buckets.entries()].sort(([left], [right]) => {
    if (left === 'Ungrouped') return 1
    if (right === 'Ungrouped') return -1
    return left.localeCompare(right, undefined, { sensitivity: 'base' })
  })
}

function useRecordList(path, label) {
  const push = useToastStore((state) => state.push)
  const [items, setItems] = useState(null)

  const load = useCallback(async () => {
    try {
      setItems((await get(path)) || EMPTY_LIST)
    } catch (error) {
      setItems(EMPTY_LIST)
      push(error?.message || `The ${label} could not be loaded.`, 'error')
    }
  }, [path, label, push])

  useEffect(() => {
    load()
  }, [load])

  return { items, load }
}

function ServerList() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const { items, load } = useRecordList('/map/servers', 'servers')
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await del(`/map/servers/${deleting.id}`)
      push('Server deleted.', 'success')
      setDeleting(null)
      await load()
      await refreshSession().catch(() => {})
    } catch (error) {
      push(error?.message || 'The server could not be deleted.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!items) return <LoadingState label="Loading servers" />

  return (
    <Stack spacing={1.25}>
      {!items.length ? (
        <Box sx={{ py: 6, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>No Servers Yet</Typography>
          <CreateAction label="New Server" onClick={() => navigate('/map/servers/new')} />
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {items.map((item) => (
            <EntityCard
              key={item.id}
              title={item.name || item.code}
              active={Boolean(item.defaultServer)}
              actions={
                <>
                  <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/map/servers/${item.id}`)} />
                  <IconAction label="Delete" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy} onClick={() => setDeleting(item)} />
                </>
              }
            />
          ))}
        </Stack>
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete This Server?"
        message={deleting ? `“${deleting.name || deleting.code}” will be removed.` : ''}
        confirmLabel="Delete"
        busy={busy}
        onClose={() => { if (!busy) setDeleting(null) }}
        onConfirm={confirmDelete}
      />
    </Stack>
  )
}

function ServerFields({ form, errors, change }) {
  return (
    <>
      <SectionLabel>Identity</SectionLabel>
      <Stack spacing={1.5}>
        {SERVER_TEXT.slice(0, 2).map(([name, label]) => (
          <Field key={name} name={name} label={label} form={form} errors={errors} onChange={change} />
        ))}
      </Stack>
      <SectionLabel>Endpoints</SectionLabel>
      <Stack spacing={1.5}>
        {SERVER_TEXT.slice(2).map(([name, label]) => (
          <Field key={name} name={name} label={label} form={form} errors={errors} onChange={change} />
        ))}
      </Stack>
      <SectionLabel>Options</SectionLabel>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        <Flag name="enabled" label="Enabled" form={form} onChange={change} />
        <Flag name="defaultServer" label="Default Server" form={form} onChange={change} />
      </Stack>
    </>
  )
}

function ServerEditor() {
  const { id } = useParams()
  const isNew = id === 'new' || !id
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [form, setForm] = useState(EMPTY_SERVER)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(isNew)
  const [missing, setMissing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)

  useEffect(() => {
    if (isNew) return undefined
    let live = true
    get('/map/servers')
      .then((rows) => {
        if (!live) return
        const found = (rows || []).find((row) => String(row.id) === String(id))
        if (!found) setMissing(true)
        else setForm(orEmpty(found, EMPTY_SERVER))
        setReady(true)
      })
      .catch((error) => {
        if (!live) return
        setMessage(error?.message || 'The server could not be opened.')
        setReady(true)
      })
    return () => { live = false }
  }, [id, isNew])

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const save = async () => {
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      const body = { ...form, code: form.code.trim(), name: form.name.trim(), enabled: Boolean(form.enabled), defaultServer: Boolean(form.defaultServer) }
      if (isNew) await post('/map/servers', body)
      else await put(`/map/servers/${id}`, body)
      logger.info(isNew ? 'map.admin.created' : 'map.admin.updated', { path: '/map/servers', id })
      push('Server saved.', 'success')
      await refreshSession().catch(() => {})
      navigate('/map/servers', { replace: true })
    } catch (error) {
      setErrors(error?.fieldErrors || {})
      setMessage(error?.message || 'The server could not be saved.')
      push(error?.message || 'The server could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await del(`/map/servers/${id}`)
      push('Server deleted.', 'success')
      await refreshSession().catch(() => {})
      navigate('/map/servers', { replace: true })
    } catch (error) {
      push(error?.message || 'The server could not be deleted.', 'error')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <LoadingState label="Opening server" />
  if (missing) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">This server is no longer available.</Typography>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/map/servers')} />
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/map/servers')} disabled={busy} />
      </Box>
      <ServerFields form={form} errors={errors} change={change} />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <IconAction label={busy ? 'Saving…' : isNew ? 'Create Server' : 'Save Server'} icon={<SaveOutlinedIcon fontSize="small" />} onClick={save} disabled={busy || !form.code.trim() || !form.name.trim()} variant="contained" />
        {!isNew ? <IconAction label="Delete" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy} onClick={() => setConfirmDelete(true)} /> : null}
      </Stack>
      <ConfirmDialog open={confirmDelete} title="Delete This Server?" message="Delete this server? This cannot be undone." confirmLabel="Delete" busy={busy} onClose={() => { if (!busy) setConfirmDelete(false) }} onConfirm={remove} />
    </Stack>
  )
}

function LayerList() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const { items, load } = useRecordList('/map/layers', 'layers')
  const [deleting, setDeleting] = useState(null)
  const [busy, setBusy] = useState(false)
  const groups = items ? layerGroups(items) : []

  const confirmDelete = async () => {
    if (!deleting) return
    setBusy(true)
    try {
      await del(`/map/layers/${deleting.id}`)
      push('Layer deleted.', 'success')
      setDeleting(null)
      await load()
      await refreshSession().catch(() => {})
    } catch (error) {
      push(error?.message || 'The layer could not be deleted.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!items) return <LoadingState label="Loading layers" />

  return (
    <Stack spacing={1.25}>
      {!items.length ? (
        <Box sx={{ py: 6, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>No Layers Yet</Typography>
          <CreateAction label="New Layer" onClick={() => navigate('/map/layers/new')} />
        </Box>
      ) : (
        groups.map(([name, rows]) => (
          <CollapsibleField key={name} title={name} defaultOpen={false}>
            <Stack spacing={0.75}>
              {rows.map((item) => (
                <EntityCard
                  key={item.id}
                  title={item.label || item.code}
                  actions={
                    <>
                      <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/map/layers/${item.id}`)} />
                      <IconAction label="Delete" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy} onClick={() => setDeleting(item)} />
                    </>
                  }
                />
              ))}
            </Stack>
          </CollapsibleField>
        ))
      )}
      <ConfirmDialog
        open={Boolean(deleting)}
        title="Delete This Layer?"
        message={deleting ? `“${deleting.label || deleting.code}” will be removed.` : ''}
        confirmLabel="Delete"
        busy={busy}
        onClose={() => { if (!busy) setDeleting(null) }}
        onConfirm={confirmDelete}
      />
    </Stack>
  )
}

function LayerFields({ form, errors, change, servers }) {
  return (
    <>
      <SectionLabel>Layer</SectionLabel>
      <Stack spacing={1.5}>
        <SearchSelect
          size="small"
          required
          label="GIS Server"
          options={servers}
          value={form.gisServerId}
          onChange={(id) => change('gisServerId', id)}
          error={Boolean(errors.gisServerId)}
          helperText={errors.gisServerId || undefined}
          getOptionLabel={(server) => server.name || server.code}
          getOptionValue={(server) => server.id}
        />
        {LAYER_TEXT.map(([name, label]) => (
          <Field key={name} name={name} label={label} form={form} errors={errors} onChange={change} />
        ))}
      </Stack>
      <SectionLabel>Display</SectionLabel>
      <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {LAYER_NUMBER.map(([name, label]) => (
          <Field key={name} name={name} label={label} type="number" form={form} errors={errors} onChange={change} sx={{ flex: { xs: '1 1 100%', sm: '1 1 8rem' }, minWidth: { xs: '100%', sm: '8rem' }, maxWidth: '100%', width: 'auto' }} />
        ))}
      </Stack>
      <Stack direction="row" spacing={1} useFlexGap sx={{ flexWrap: 'wrap' }}>
        {LAYER_FLAGS.map(([name, label]) => (
          <Flag key={name} name={name} label={label} form={form} onChange={change} />
        ))}
      </Stack>
    </>
  )
}

function LayerEditor() {
  const { id } = useParams()
  const isNew = id === 'new' || !id
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [form, setForm] = useState(EMPTY_LAYER)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [ready, setReady] = useState(isNew)
  const [missing, setMissing] = useState(false)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const [servers, setServers] = useState(EMPTY_LIST)

  useEffect(() => {
    let live = true
    get('/map/servers').then((rows) => live && setServers(rows || EMPTY_LIST)).catch(() => {})
    if (isNew) return () => { live = false }
    get('/map/layers')
      .then((rows) => {
        if (!live) return
        const found = (rows || []).find((row) => String(row.id) === String(id))
        if (!found) setMissing(true)
        else setForm(orEmpty(found, EMPTY_LAYER))
        setReady(true)
      })
      .catch((error) => {
        if (!live) return
        setMessage(error?.message || 'The layer could not be opened.')
        setReady(true)
      })
    return () => { live = false }
  }, [id, isNew])

  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const save = async () => {
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      const body = {
        ...form,
        gisServerId: toNumber(form.gisServerId),
        code: form.code.trim(),
        sortOrder: toNumber(form.sortOrder) ?? 0,
        defaultOpacity: toNumber(form.defaultOpacity) ?? 1,
        minZoom: toNumber(form.minZoom),
        maxZoom: toNumber(form.maxZoom),
      }
      if (isNew) await post('/map/layers', body)
      else await put(`/map/layers/${id}`, body)
      logger.info(isNew ? 'map.admin.created' : 'map.admin.updated', { path: '/map/layers', id })
      push('Layer saved.', 'success')
      await refreshSession().catch(() => {})
      navigate('/map/layers', { replace: true })
    } catch (error) {
      setErrors(error?.fieldErrors || {})
      setMessage(error?.message || 'The layer could not be saved.')
      push(error?.message || 'The layer could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    setBusy(true)
    try {
      await del(`/map/layers/${id}`)
      push('Layer deleted.', 'success')
      await refreshSession().catch(() => {})
      navigate('/map/layers', { replace: true })
    } catch (error) {
      push(error?.message || 'The layer could not be deleted.', 'error')
      setConfirmDelete(false)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <LoadingState label="Opening layer" />
  if (missing) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">This layer is no longer available.</Typography>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/map/layers')} />
      </Stack>
    )
  }

  return (
    <Stack spacing={2}>
      {message ? <Alert severity="error">{message}</Alert> : null}
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/map/layers')} disabled={busy} />
      </Box>
      <LayerFields form={form} errors={errors} change={change} servers={servers} />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <IconAction label={busy ? 'Saving…' : isNew ? 'Create Layer' : 'Save Layer'} icon={<SaveOutlinedIcon fontSize="small" />} onClick={save} disabled={busy || !form.code.trim()} variant="contained" />
        {!isNew ? <IconAction label="Delete" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy} onClick={() => setConfirmDelete(true)} /> : null}
      </Stack>
      <ConfirmDialog open={confirmDelete} title="Delete This Layer?" message="Delete this layer? This cannot be undone." confirmLabel="Delete" busy={busy} onClose={() => { if (!busy) setConfirmDelete(false) }} onConfirm={remove} />
    </Stack>
  )
}

function ViewDefaultsTab() {
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [form, setForm] = useState(null)
  const [errors, setErrors] = useState({})
  const [message, setMessage] = useState('')
  const [busy, setBusy] = useState(false)
  const [layers, setLayers] = useState(EMPTY_LIST)
  const [servers, setServers] = useState(EMPTY_LIST)
  const locationOwner = useSharedMapPick((point) => setForm((current) => (
    current ? { ...current, centerLat: point.latitude, centerLon: point.longitude } : current
  )))

  useEffect(() => {
    let live = true
    get('/map/servers').then((rows) => live && setServers(rows || EMPTY_LIST)).catch(() => {})
    get('/map/layers').then((rows) => live && setLayers(rows || EMPTY_LIST)).catch(() => {})
    get('/map/view-defaults')
      .then((value) => live && setForm(orEmpty(value, EMPTY_VIEW)))
      .catch((error) => {
        if (!live) return
        setForm(EMPTY_VIEW)
        setMessage(error?.message || 'The view defaults could not be loaded.')
        push(error?.message || 'The view defaults could not be loaded.', 'error')
      })
    return () => {
      live = false
    }
  }, [push])

  if (!form) return <LoadingState label="Loading view defaults" />
  const change = (name, value) => setForm((current) => ({ ...current, [name]: value }))

  const save = async () => {
    setBusy(true)
    setErrors({})
    setMessage('')
    try {
      const body = { ...form }
      VIEW_NUMBER.forEach(([name]) => { body[name] = toNumber(form[name]) })
      body.defaultGisServerId = toNumber(form.defaultGisServerId)
      body.elevationLayerId = toNumber(form.elevationLayerId)
      body.elevationPositiveUp = Boolean(form.elevationPositiveUp)
      body.dataCrs = String(form.dataCrs || 'EPSG:4326').trim()
      body.viewCrs = String(form.viewCrs || 'EPSG:3857').trim()
      body.elevationAttribute = String(form.elevationAttribute || '').trim()
      const saved = await put('/map/view-defaults', body)
      if (saved) setForm(orEmpty(saved, EMPTY_VIEW))
      logger.info('map.admin.view-defaults.updated')
      push('View defaults saved.', 'success')
      try {
        await refreshSession()
      } catch {
        /* shell catalogue is best-effort */
      }
    } catch (error) {
      const text = error?.message || 'The view defaults could not be saved.'
      setErrors(error?.fieldErrors || {})
      setMessage(text)
      push(text, 'error')
      logger.warn('map.admin.failed', { path: '/map/view-defaults', message: text })
    } finally {
      setBusy(false)
    }
  }

  return (
    <Box
      sx={{
        borderRadius: 2,
        border: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
        p: { xs: 1.75, sm: 2.25 },
        maxWidth: '100%',
      }}
    >
      <Stack spacing={1.75}>
        <Typography variant="subtitle1" sx={{ fontWeight: 650 }}>
          Home View
        </Typography>
        <Divider />
        {message ? <Alert severity="error">{message}</Alert> : null}
        <SectionLabel>Centre And Zoom</SectionLabel>
        <Stack direction="row" spacing={1.5} useFlexGap sx={{ flexWrap: 'wrap' }}>
          {VIEW_NUMBER.map(([name, label]) => (
            <Field
              key={name}
              name={name}
              label={label}
              type="number"
              form={form}
              errors={errors}
              onChange={change}
              slotProps={name === 'centerLat' || name === 'centerLon' ? { input: { startAdornment: locationStartAdornment(locationOwner) } } : undefined}
              sx={{ flex: { xs: '1 1 100%', sm: '1 1 8rem' }, minWidth: { xs: '100%', sm: '8rem' }, maxWidth: '100%', width: 'auto' }}
            />
          ))}
        </Stack>
        <SectionLabel>Coordinate system</SectionLabel>
        <Stack direction="column" spacing={1.5}>
          <Field name="dataCrs" label="Data CRS" form={form} errors={errors} onChange={change} />
          <Field name="viewCrs" label="Map CRS" form={form} errors={errors} onChange={change} />
        </Stack>
        <SectionLabel>Height and depth</SectionLabel>
        <SearchSelect
          size="small"
          label="Elevation layer"
          clearLabel="None"
          options={layers}
          value={form.elevationLayerId}
          onChange={(id) => change('elevationLayerId', id)}
          getOptionLabel={(layer) => layer.label || layer.code}
          getOptionValue={(layer) => layer.id}
        />
        <Field name="elevationAttribute" label="Elevation property" form={form} errors={errors} onChange={change} />
        <Flag name="elevationPositiveUp" label="Positive value is land height" form={form} onChange={change} />
        <SectionLabel>Default server</SectionLabel>
        <SearchSelect
          size="small"
          label="Default GIS Server"
          clearLabel="None"
          options={servers}
          value={form.defaultGisServerId}
          onChange={(id) => change('defaultGisServerId', id)}
          error={Boolean(errors.defaultGisServerId)}
          helperText={errors.defaultGisServerId || undefined}
          getOptionLabel={(server) => server.name || server.code}
          getOptionValue={(server) => server.id}
        />
        <Divider />
        <IconAction
          label={busy ? 'Saving…' : 'Save Home View'}
          icon={<SaveOutlinedIcon fontSize="small" />}
          disabled={busy}
          onClick={save}
          variant="contained"
        />
      </Stack>
    </Box>
  )
}

export function MapServersPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout actions={<CreateAction label="New Server" onClick={() => navigate('/map/servers/new')} />}>
      <ServerList />
    </ExerciseLayout>
  )
}

export function MapServerEditorPage() {
  return (
    <ExerciseLayout>
      <ServerEditor />
    </ExerciseLayout>
  )
}

export function MapLayersPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout actions={<CreateAction label="New Layer" onClick={() => navigate('/map/layers/new')} />}>
      <LayerList />
    </ExerciseLayout>
  )
}

export function MapLayerEditorPage() {
  return (
    <ExerciseLayout>
      <LayerEditor />
    </ExerciseLayout>
  )
}

export function MapSettingsPage() {
  return (
    <ExerciseLayout>
      <ViewDefaultsTab />
    </ExerciseLayout>
  )
}
