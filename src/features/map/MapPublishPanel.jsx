import { useCallback, useEffect, useMemo, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Alert,
  Autocomplete,
  Box,
  Button,
  Checkbox,
  Chip,
  FormControlLabel,
  LinearProgress,
  MenuItem,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import { createFilterOptions } from '@mui/material/Autocomplete'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import CloudUploadOutlinedIcon from '@mui/icons-material/CloudUploadOutlined'
import RefreshOutlinedIcon from '@mui/icons-material/RefreshOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import { LoadingState } from '../../shared/ui/LoadingState'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { del, get, post, postForm, put } from '../../shared/api/http'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { ExerciseLayout } from '../scenario/ExerciseLayout'

function detectType(fileName) {
  const lower = String(fileName || '').toLowerCase()
  if (lower.endsWith('.zip')) return 'SHAPEFILE_ZIP'
  if (lower.endsWith('.geojson') || lower.endsWith('.json')) return 'GEOJSON'
  if (lower.endsWith('.tif') || lower.endsWith('.tiff')) return 'GEOTIFF'
  return ''
}

function baseName(fileName) {
  return String(fileName || 'layer').replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9_\-]+/g, '_')
}

function useServers() {
  const [servers, setServers] = useState(EMPTY_LIST)
  useEffect(() => {
    get('/map/servers').then((rows) => setServers(rows || EMPTY_LIST)).catch(() => setServers(EMPTY_LIST))
  }, [])
  return servers
}

export function MapPublishPage() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const servers = useServers()
  const [step, setStep] = useState(0)
  const [serverId, setServerId] = useState('')
  const [workspace, setWorkspace] = useState('')
  const [policy, setPolicy] = useState('SKIP')
  const [defaultCrs, setDefaultCrs] = useState('EPSG:4326')
  const [items, setItems] = useState([])
  const [dryRun, setDryRun] = useState(null)
  const [job, setJob] = useState(null)
  const [busy, setBusy] = useState(false)
  const [tab, setTab] = useState(0)
  const [postgis, setPostgis] = useState({
    host: 'localhost', port: 5432, database: '', schema: 'public', username: '', password: '', storeName: 'postgis', tables: '',
  })

  useEffect(() => {
    if (!serverId && servers.length) {
      const preferred = servers.find((item) => item.defaultServer) || servers[0]
      setServerId(String(preferred.id))
      setWorkspace(preferred.workspaceDefault || 'ne')
    }
  }, [servers, serverId])

  useEffect(() => {
    if (!job?.id) return undefined
    if (['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(job.status)) return undefined
    const timer = setInterval(() => {
      get(`/map/publish/jobs/${job.id}`)
        .then((next) => setJob(next))
        .catch(() => {})
    }, 1500)
    return () => clearInterval(timer)
  }, [job?.id, job?.status])

  const groups = useMemo(() => {
    const counts = new Map()
    items.forEach((item) => {
      const key = item.groupCode || 'Ungrouped'
      counts.set(key, (counts.get(key) || 0) + 1)
    })
    return [...counts.entries()]
  }, [items])

  const onFiles = (fileList) => {
    const next = [...items]
    Array.from(fileList || []).forEach((file) => {
      const type = detectType(file.name)
      if (!type) {
        push(`Unsupported file: ${file.name}`, 'warning')
        return
      }
      next.push({
        clientKey: `${file.name}-${file.size}-${file.lastModified}`,
        file,
        fileName: file.name,
        sourceType: type,
        targetLayerName: baseName(file.name),
        title: baseName(file.name),
        groupCode: '',
        styleName: '',
      })
    })
    setItems(next)
  }

  const runDryRun = async () => {
    setBusy(true)
    try {
      const result = await post('/map/publish/dry-run', {
        gisServerId: Number(serverId),
        workspace,
        overwritePolicy: policy,
        items: items.map((item) => ({
          clientKey: item.clientKey,
          sourceType: item.sourceType,
          fileName: item.fileName,
          tableName: item.tableName,
          targetLayerName: item.targetLayerName,
          groupCode: item.groupCode || null,
        })),
      })
      setDryRun(result)
      setStep(4)
    } catch (error) {
      push(error?.message || 'Dry-run failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const publishFiles = async () => {
    setBusy(true)
    try {
      const form = new FormData()
      const manifest = {
        gisServerId: Number(serverId),
        workspace,
        overwritePolicy: policy,
        defaultCrs,
        items: items.map((item) => ({
          clientKey: item.clientKey,
          fileField: item.clientKey,
          fileName: item.fileName,
          sourceType: item.sourceType,
          targetLayerName: item.targetLayerName,
          groupCode: item.groupCode || null,
          styleName: item.styleName || null,
          title: item.title || item.targetLayerName,
        })),
      }
      form.append('manifest', new Blob([JSON.stringify(manifest)], { type: 'application/json' }))
      items.forEach((item) => {
        if (item.file) form.append('files', item.file, item.fileName)
      })
      const created = await postForm('/map/publish/jobs', form)
      setJob(created)
      setStep(5)
      push('Publish job started.', 'success')
    } catch (error) {
      push(error?.message || 'Could not start publish job.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const publishPostgis = async () => {
    setBusy(true)
    try {
      const tables = String(postgis.tables || '')
        .split(/[\n,]+/)
        .map((value) => value.trim())
        .filter(Boolean)
        .map((tableName) => ({
          tableName,
          targetLayerName: tableName,
          groupCode: items[0]?.groupCode || null,
          title: tableName,
        }))
      const created = await post('/map/publish/jobs/postgis', {
        gisServerId: Number(serverId),
        workspace,
        overwritePolicy: policy,
        defaultCrs,
        storeName: postgis.storeName,
        host: postgis.host,
        port: Number(postgis.port) || 5432,
        database: postgis.database,
        schema: postgis.schema,
        username: postgis.username,
        password: postgis.password,
        tables,
      })
      setJob(created)
      setStep(5)
      push('PostGIS publish job started.', 'success')
    } catch (error) {
      push(error?.message || 'Could not start PostGIS job.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const retryFailed = async () => {
    if (!job?.id) return
    try {
      const next = await post(`/map/publish/jobs/${job.id}/retry`)
      setJob(next)
      push('Retrying failed items.', 'success')
    } catch (error) {
      push(error?.message || 'Retry failed.', 'error')
    }
  }

  const cancelJob = async () => {
    if (!job?.id) return
    try {
      const next = await post(`/map/publish/jobs/${job.id}/cancel`)
      setJob(next)
    } catch (error) {
      push(error?.message || 'Cancel failed.', 'error')
    }
  }

  const done = async () => {
    await refreshSession().catch(() => {})
    navigate('/')
  }

  return (
    <ExerciseLayout>
      <Stack spacing={2}>
        <Tabs
          value={tab}
          onChange={(_, value) => {
            if (value === 2) {
              navigate('/map/publish/jobs')
              return
            }
            setTab(value)
          }}
        >
          <Tab label="Files" />
          <Tab label="PostGIS" />
          <Tab label="Job history" />
        </Tabs>

        {tab === 0 ? (
          <Stack spacing={2}>
            <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
              {[0, 1, 2, 3, 4, 5].map((value) => (
                <Chip key={value} size="small" label={['Source', 'Names', 'Groups', 'Options', 'Dry-run', 'Run'][value]} color={step === value ? 'primary' : 'default'} onClick={() => setStep(value)} />
              ))}
            </Stack>

            {step === 0 ? (
              <Stack spacing={1.5}>
                <SearchSelect
                  size="small"
                  label="GIS server"
                  value={serverId}
                  onChange={setServerId}
                  options={servers}
                  getOptionLabel={(item) => item.name || item.code}
                  getOptionValue={(item) => item.id}
                />
                <Button variant="outlined" component="label" startIcon={<CloudUploadOutlinedIcon />}>
                  Add files (.zip / .geojson / .tif)
                  <input hidden multiple type="file" accept=".zip,.geojson,.json,.tif,.tiff" onChange={(event) => onFiles(event.target.files)} />
                </Button>
                <Typography variant="body2" color="text.secondary">{items.length} file(s) selected</Typography>
                <Button variant="contained" disabled={!items.length || !serverId} onClick={() => setStep(1)}>Next</Button>
              </Stack>
            ) : null}

            {step === 1 ? (
              <Stack spacing={1.25}>
                {items.map((item, index) => (
                  <Stack key={item.clientKey} direction={{ xs: 'column', md: 'row' }} spacing={1}>
                    <TextField size="small" label="File" value={item.fileName} disabled fullWidth />
                    <TextField size="small" label="Type" value={item.sourceType} disabled sx={{ minWidth: 140 }} />
                    <TextField
                      size="small"
                      label="Layer name"
                      value={item.targetLayerName}
                      onChange={(event) => {
                        const next = [...items]
                        next[index] = { ...item, targetLayerName: event.target.value }
                        setItems(next)
                      }}
                      fullWidth
                    />
                  </Stack>
                ))}
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setStep(0)}>Back</Button>
                  <Button variant="contained" onClick={() => setStep(2)}>Next</Button>
                </Stack>
              </Stack>
            ) : null}

            {step === 2 ? (
              <Stack spacing={1.25}>
                <Typography variant="body2" color="text.secondary">
                  Assign a group code to each layer. Publishing a group creates a GeoServer layer group.
                </Typography>
                {groups.map(([name, count]) => (
                  <Chip key={name} label={`${name}: ${count}`} sx={{ mr: 1 }} />
                ))}
                {items.map((item, index) => (
                  <Stack key={item.clientKey} direction="row" spacing={1}>
                    <TextField size="small" label="Layer" value={item.targetLayerName} disabled sx={{ flex: 1 }} />
                    <TextField
                      size="small"
                      label="Group code"
                      value={item.groupCode}
                      onChange={(event) => {
                        const next = [...items]
                        next[index] = { ...item, groupCode: event.target.value.trim() }
                        setItems(next)
                      }}
                      sx={{ flex: 1 }}
                    />
                  </Stack>
                ))}
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setStep(1)}>Back</Button>
                  <Button variant="contained" onClick={() => setStep(3)}>Next</Button>
                </Stack>
              </Stack>
            ) : null}

            {step === 3 ? (
              <Stack spacing={1.5}>
                <TextField size="small" label="Workspace" value={workspace} onChange={(event) => setWorkspace(event.target.value)} />
                <TextField select size="small" label="Overwrite policy" value={policy} onChange={(event) => setPolicy(event.target.value)}>
                  <MenuItem value="SKIP">Skip existing</MenuItem>
                  <MenuItem value="RENAME">Rename</MenuItem>
                  <MenuItem value="OVERWRITE">Overwrite</MenuItem>
                </TextField>
                <TextField size="small" label="Default CRS" value={defaultCrs} onChange={(event) => setDefaultCrs(event.target.value)} />
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setStep(2)}>Back</Button>
                  <Button variant="contained" disabled={busy} onClick={runDryRun}>Dry-run</Button>
                </Stack>
              </Stack>
            ) : null}

            {step === 4 ? (
              <Stack spacing={1.5}>
                {dryRun?.connectionError ? <Alert severity="error">{dryRun.connectionError}</Alert> : null}
                <Alert severity={dryRun?.ok ? 'success' : 'warning'}>
                  {dryRun?.ok ? 'Dry-run passed.' : 'Dry-run found issues. You can still publish; failed items will be reported.'}
                </Alert>
                {(dryRun?.items || []).map((row) => (
                  <Typography key={row.clientKey} variant="body2">
                    {row.targetLayerName}: {row.ok ? 'OK' : (row.problems || []).join(', ')}
                    {row.existsOnGeoServer ? ' (exists)' : ''}
                  </Typography>
                ))}
                <Stack direction="row" spacing={1}>
                  <Button onClick={() => setStep(3)}>Back</Button>
                  <Button variant="contained" disabled={busy || !items.length} onClick={publishFiles}>Publish</Button>
                </Stack>
              </Stack>
            ) : null}

            {step === 5 && job ? (
              <Stack spacing={1.5}>
                <Typography variant="subtitle1">Job #{job.id} — {job.status}</Typography>
                <LinearProgress variant={job.totalItems ? 'determinate' : 'indeterminate'} value={job.totalItems ? ((job.succeededItems + job.failedItems + job.skippedItems) / job.totalItems) * 100 : 0} />
                <Typography variant="body2">{job.succeededItems} ok · {job.failedItems} failed · {job.skippedItems} skipped / {job.totalItems}</Typography>
                <Stack spacing={0.75} sx={{ maxHeight: 320, overflow: 'auto' }}>
                  {(job.items || []).map((item) => (
                    <Typography key={item.id} variant="caption">
                      {item.targetLayerName} [{item.groupCode || '—'}] — {item.status}
                      {item.errorMessage ? `: ${item.errorMessage}` : ''}
                    </Typography>
                  ))}
                </Stack>
                <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
                  {!['COMPLETED', 'PARTIAL', 'FAILED', 'CANCELLED'].includes(job.status) ? (
                    <Button color="warning" onClick={cancelJob}>Cancel</Button>
                  ) : null}
                  {job.failedItems > 0 ? <Button onClick={retryFailed}>Retry failed</Button> : null}
                  <Button variant="contained" onClick={done}>Done — open map</Button>
                  <Button onClick={() => navigate('/map/layer-groups')}>Manage groups</Button>
                </Stack>
              </Stack>
            ) : null}
          </Stack>
        ) : null}

        {tab === 1 ? (
          <Stack spacing={1.5}>
            <SearchSelect
              size="small"
              label="GIS server"
              value={serverId}
              onChange={setServerId}
              options={servers}
              getOptionLabel={(item) => item.name || item.code}
              getOptionValue={(item) => item.id}
            />
            {['host', 'port', 'database', 'schema', 'username', 'password', 'storeName'].map((name) => (
              <TextField
                key={name}
                size="small"
                type={name === 'password' ? 'password' : 'text'}
                label={name}
                value={postgis[name]}
                onChange={(event) => setPostgis((current) => ({ ...current, [name]: event.target.value }))}
              />
            ))}
            <TextField
              size="small"
              label="Tables (comma or newline separated)"
              value={postgis.tables}
              onChange={(event) => setPostgis((current) => ({ ...current, tables: event.target.value }))}
              multiline
              minRows={3}
            />
            <TextField size="small" label="Workspace" value={workspace} onChange={(event) => setWorkspace(event.target.value)} />
            <Button variant="contained" disabled={busy || !serverId || !postgis.database || !postgis.tables.trim()} onClick={publishPostgis}>
              Publish tables
            </Button>
          </Stack>
        ) : null}
      </Stack>
    </ExerciseLayout>
  )
}

export function MapPublishJobsPage() {
  const navigate = useNavigate()
  const [jobs, setJobs] = useState(null)
  const push = useToastStore((state) => state.push)

  const load = useCallback(async () => {
    try {
      setJobs(await get('/map/publish/jobs') || EMPTY_LIST)
    } catch (error) {
      setJobs(EMPTY_LIST)
      push(error?.message || 'Could not load jobs.', 'error')
    }
  }, [push])

  useEffect(() => { load() }, [load])

  if (!jobs) return <ExerciseLayout><LoadingState label="Loading jobs" /></ExerciseLayout>

  return (
    <ExerciseLayout>
      <Stack spacing={1}>
        <IconAction label="Refresh" icon={<RefreshOutlinedIcon fontSize="small" />} onClick={load} />
        {!jobs.length ? <Typography color="text.secondary">No publish jobs yet.</Typography> : null}
        {jobs.map((job) => (
          <EntityCard
            key={job.id}
            title={`Job #${job.id} — ${job.status}`}
            active={job.status === 'RUNNING' || job.status === 'QUEUED'}
            actions={<IconAction label="Open" icon={<ArrowBackIcon fontSize="small" sx={{ transform: 'rotate(180deg)' }} />} onClick={() => navigate(`/map/publish/jobs/${job.id}`)} />}
          />
        ))}
      </Stack>
    </ExerciseLayout>
  )
}

export function MapPublishJobDetailPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [job, setJob] = useState(null)
  const push = useToastStore((state) => state.push)

  useEffect(() => {
    let live = true
    const pull = () => get(`/map/publish/jobs/${id}`).then((row) => { if (live) setJob(row) }).catch((error) => push(error?.message || 'Job missing.', 'error'))
    pull()
    const timer = setInterval(pull, 1500)
    return () => { live = false; clearInterval(timer) }
  }, [id, push])

  if (!job) return <ExerciseLayout><LoadingState label="Loading job" /></ExerciseLayout>

  return (
    <ExerciseLayout>
      <Stack spacing={1.25}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/map/publish/jobs')} />
        <Typography>Job #{job.id} — {job.status} — {job.message || ''}</Typography>
        <LinearProgress variant="determinate" value={job.totalItems ? ((job.succeededItems + job.failedItems + job.skippedItems) / job.totalItems) * 100 : 0} />
        {(job.items || []).map((item) => (
          <Typography key={item.id} variant="body2">
            {item.targetLayerName} · {item.status}{item.errorMessage ? ` — ${item.errorMessage}` : ''}
          </Typography>
        ))}
      </Stack>
    </ExerciseLayout>
  )
}

const groupFilter = createFilterOptions({ stringify: (option) => option?.label || option?.inputValue || '' })

/** Dropdown + type-ahead: pick an existing Warplan group or type a new name. Empty = no group. */
function GroupCombo({ value, onChange, options, disabled, label = 'Group', sx }) {
  const selected = value
    ? options.find((item) => item.label.toLowerCase() === value.toLowerCase() || item.code.toLowerCase() === value.toLowerCase())
      || { label: value, code: value, inputValue: value }
    : null

  return (
    <Autocomplete
      size="small"
      freeSolo
      selectOnFocus
      clearOnBlur
      handleHomeEndKeys
      disabled={disabled}
      options={options}
      value={selected}
      sx={sx}
      filterOptions={(items, params) => {
        const filtered = groupFilter(items, params)
        const typed = params.inputValue.trim()
        if (!typed) return filtered
        const exists = items.some((item) => item.label.toLowerCase() === typed.toLowerCase()
          || item.code.toLowerCase() === typed.toLowerCase())
        if (!exists) {
          filtered.push({
            inputValue: typed,
            label: `Create “${typed}”`,
            code: typed,
            isNew: true,
          })
        }
        return filtered
      }}
      getOptionLabel={(option) => {
        if (typeof option === 'string') return option
        if (option.isNew) return option.inputValue || option.label
        return option.label || option.code || ''
      }}
      isOptionEqualToValue={(left, right) =>
        String(left?.code || left?.label || '').toLowerCase() === String(right?.code || right?.label || '').toLowerCase()
      }
      onChange={(_, next) => {
        if (!next) {
          onChange('')
          return
        }
        if (typeof next === 'string') {
          onChange(next.trim())
          return
        }
        onChange((next.inputValue || next.label || next.code || '').trim())
      }}
      renderOption={(props, option) => {
        const { key, ...rest } = props
        return (
          <li key={key} {...rest}>
            {option.isNew ? option.label : option.label}
          </li>
        )
      }}
      renderInput={(params) => (
        <TextField {...params} label={label} placeholder="None / pick / type new" />
      )}
    />
  )
}

export function MapImportPage() {
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const servers = useServers()
  const [serverId, setServerId] = useState('')
  const [tab, setTab] = useState(0)
  const [discover, setDiscover] = useState(null)
  /** @type {[Record<string, { group: string }>, Function]} */
  const [selected, setSelected] = useState({})
  const [bulkGroup, setBulkGroup] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!serverId && servers.length) setServerId(String((servers.find((item) => item.defaultServer) || servers[0]).id))
  }, [servers, serverId])

  const appGroups = useMemo(() => {
    const rows = discover?.appGroups || []
    return rows.map((row) => ({
      id: row.id,
      code: row.code,
      label: row.label || row.code,
    }))
  }, [discover])

  const refresh = async () => {
    if (!serverId) return
    setBusy(true)
    try {
      setDiscover(await get('/map/gs/discover', { gisServerId: serverId }))
      setSelected({})
      setBulkGroup('')
    } catch (error) {
      push(error?.message || 'Could not discover GeoServer catalog.', 'error')
    } finally {
      setBusy(false)
    }
  }

  useEffect(() => { if (serverId) refresh() }, [serverId])

  const rows = tab === 0 ? (discover?.layers || []) : (discover?.layerGroups || [])
  const selectedNames = Object.keys(selected)

  const toggle = (name, inApp) => {
    if (inApp && tab === 0) {
      // Allow re-selecting already-in-app layers so they can be moved into a group
    }
    setSelected((current) => {
      const next = { ...current }
      if (next[name]) delete next[name]
      else next[name] = { group: '' }
      return next
    })
  }

  const setLayerGroup = (name, group) => {
    setSelected((current) => {
      if (!current[name]) return current
      return { ...current, [name]: { ...current[name], group } }
    })
  }

  const applyBulkGroup = () => {
    if (!selectedNames.length) return
    setSelected((current) => {
      const next = { ...current }
      selectedNames.forEach((name) => {
        next[name] = { ...next[name], group: bulkGroup }
      })
      return next
    })
  }

  const importSelected = async () => {
    if (!selectedNames.length) return
    setBusy(true)
    try {
      if (tab === 0) {
        const result = await post('/map/gs/import-layers', {
          gisServerId: Number(serverId),
          layers: selectedNames.map((name) => ({
            wmsLayers: name,
            groupCode: selected[name]?.group?.trim() || null,
          })),
        })
        const groupNote = result.groupsUpdated ? `, ${result.groupsUpdated} group(s) updated` : ''
        push(`Imported ${result.imported} layer(s), skipped ${result.skipped}${groupNote}.`, 'success')
      } else {
        const result = await post('/map/gs/import-layergroups', {
          gisServerId: Number(serverId),
          groups: selectedNames.map((name) => ({ gsName: name })),
        })
        push(`Imported ${result.imported} group(s), skipped ${result.skipped}.`, 'success')
      }
      await refresh()
      await refreshSession().catch(() => {})
    } catch (error) {
      push(error?.message || 'Import failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ExerciseLayout>
      <Stack spacing={2}>
        <SearchSelect
          size="small"
          label="GIS server"
          value={serverId}
          onChange={setServerId}
          options={servers}
          getOptionLabel={(item) => item.name || item.code}
          getOptionValue={(item) => item.id}
        />
        <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap" alignItems="center">
          <IconAction label="Refresh" icon={<RefreshOutlinedIcon fontSize="small" />} onClick={refresh} disabled={busy} />
          <CreateAction label="Import selected" onClick={importSelected} disabled={busy || !selectedNames.length} />
          {tab === 0 && selectedNames.length ? (
            <>
              <GroupCombo
                value={bulkGroup}
                onChange={setBulkGroup}
                options={appGroups}
                label="Assign all selected to"
                sx={{ minWidth: 220, flex: 1 }}
              />
              <Button size="small" variant="outlined" onClick={applyBulkGroup}>Apply to selected</Button>
            </>
          ) : null}
        </Stack>
        <Tabs value={tab} onChange={(_, value) => { setTab(value); setSelected({}); setBulkGroup('') }}>
          <Tab label="Layers" />
          <Tab label="Layer groups" />
        </Tabs>
        {tab === 0 ? (
          <Typography variant="body2" color="text.secondary">
            Select layers, then pick or type a group for each (or use “Assign all selected”). Same name reuses an existing group — no duplicates.
          </Typography>
        ) : null}
        {!discover ? <LoadingState label="Discovering" /> : (
          <Stack spacing={0.75} sx={{ maxHeight: 520, overflow: 'auto' }}>
            {rows.map((row) => {
              const name = row.name
              const checked = Boolean(selected[name])
              return (
                <Stack
                  key={name}
                  direction={{ xs: 'column', sm: 'row' }}
                  spacing={1}
                  alignItems={{ xs: 'stretch', sm: 'center' }}
                  sx={{
                    px: 1,
                    py: 0.75,
                    border: 1,
                    borderColor: 'divider',
                    borderRadius: 1,
                    bgcolor: checked ? 'action.selected' : 'transparent',
                  }}
                >
                  <FormControlLabel
                    sx={{ flex: 1, minWidth: 0, mr: 0 }}
                    control={
                      <Checkbox
                        size="small"
                        checked={checked}
                        onChange={() => toggle(name, row.inApp)}
                      />
                    }
                    label={
                      <Typography variant="body2" noWrap title={name}>
                        {name}{row.inApp ? ' (already in app)' : ''}
                      </Typography>
                    }
                  />
                  {tab === 0 ? (
                    <GroupCombo
                      value={selected[name]?.group || ''}
                      onChange={(group) => {
                        if (!selected[name]) {
                          setSelected((current) => ({ ...current, [name]: { group } }))
                          return
                        }
                        setLayerGroup(name, group)
                      }}
                      options={appGroups}
                      disabled={!checked}
                      label="Group"
                      sx={{ width: { xs: '100%', sm: 240 }, flexShrink: 0 }}
                    />
                  ) : null}
                </Stack>
              )
            })}
          </Stack>
        )}
      </Stack>
    </ExerciseLayout>
  )
}

export function MapLayerGroupsPage() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const [items, setItems] = useState(null)

  const load = useCallback(async () => {
    try {
      setItems(await get('/map/layer-groups') || EMPTY_LIST)
    } catch (error) {
      setItems(EMPTY_LIST)
      push(error?.message || 'Could not load groups.', 'error')
    }
  }, [push])

  useEffect(() => { load() }, [load])

  const sync = async (id) => {
    try {
      await post(`/map/layer-groups/${id}/sync`)
      push('Synced to GeoServer.', 'success')
      await load()
      await refreshSession().catch(() => {})
    } catch (error) {
      push(error?.message || 'Sync failed.', 'error')
    }
  }

  const remove = async (id) => {
    try {
      await del(`/map/layer-groups/${id}`)
      push('Group deleted.', 'success')
      await load()
      await refreshSession().catch(() => {})
    } catch (error) {
      push(error?.message || 'Delete failed.', 'error')
    }
  }

  if (!items) return <ExerciseLayout><LoadingState label="Loading groups" /></ExerciseLayout>

  return (
    <ExerciseLayout actions={<CreateAction label="New Group" onClick={() => navigate('/map/layer-groups/new')} />}>
      <Stack spacing={1}>
        {!items.length ? <Typography color="text.secondary">No layer groups yet. Publish with group codes or import from GeoServer.</Typography> : null}
        {items.map((item) => (
          <EntityCard
            key={item.id}
            title={item.label || item.code}
            active={item.active}
            actions={
              <>
                <IconAction label="Edit" icon={<SaveOutlinedIcon fontSize="small" />} onClick={() => navigate(`/map/layer-groups/${item.id}`)} />
                <IconAction label="Sync" icon={<RefreshOutlinedIcon fontSize="small" />} onClick={() => sync(item.id)} />
                <IconAction label="Delete" icon={<ArrowBackIcon fontSize="small" />} color="error" onClick={() => remove(item.id)} />
              </>
            }
          />
        ))}
      </Stack>
    </ExerciseLayout>
  )
}

export function MapLayerGroupEditorPage() {
  const { id } = useParams()
  const isNew = id === 'new' || !id
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const refreshSession = useSessionStore((state) => state.refresh)
  const servers = useServers()
  const [layers, setLayers] = useState(EMPTY_LIST)
  const [form, setForm] = useState({
    gisServerId: '', code: '', label: '', gsLayerGroupName: '', sortOrder: 100, defaultVisible: false, active: true, syncToGeoServer: true, members: [],
  })
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    get('/map/layers').then((rows) => setLayers(rows || EMPTY_LIST)).catch(() => setLayers(EMPTY_LIST))
  }, [])

  useEffect(() => {
    if (isNew) {
      if (servers[0]) setForm((current) => ({ ...current, gisServerId: String(servers[0].id) }))
      return
    }
    get('/map/layer-groups').then((rows) => {
      const found = (rows || []).find((row) => String(row.id) === String(id))
      if (!found) return
      setForm({
        gisServerId: String(found.gisServerId),
        code: found.code,
        label: found.label,
        gsLayerGroupName: found.gsLayerGroupName || '',
        sortOrder: found.sortOrder ?? 100,
        defaultVisible: Boolean(found.defaultVisible),
        active: found.active !== false,
        syncToGeoServer: true,
        members: (found.members || []).map((member) => ({
          mapLayerId: member.mapLayerId,
          sortOrder: member.sortOrder,
          styleName: member.styleName || '',
        })),
      })
    })
  }, [id, isNew, servers])

  const save = async () => {
    setBusy(true)
    try {
      const body = {
        ...form,
        gisServerId: Number(form.gisServerId),
        sortOrder: Number(form.sortOrder) || 100,
        members: form.members,
      }
      if (isNew) await post('/map/layer-groups', body)
      else await put(`/map/layer-groups/${id}`, body)
      push('Group saved.', 'success')
      await refreshSession().catch(() => {})
      navigate('/map/layer-groups')
    } catch (error) {
      push(error?.message || 'Could not save group.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleMember = (layerId) => {
    setForm((current) => {
      const exists = current.members.some((member) => Number(member.mapLayerId) === Number(layerId))
      if (exists) return { ...current, members: current.members.filter((member) => Number(member.mapLayerId) !== Number(layerId)) }
      return {
        ...current,
        members: [...current.members, { mapLayerId: Number(layerId), sortOrder: (current.members.length + 1) * 10, styleName: '' }],
      }
    })
  }

  return (
    <ExerciseLayout>
      <Stack spacing={1.5}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/map/layer-groups')} />
        <SearchSelect
          size="small"
          label="GIS server"
          value={form.gisServerId}
          onChange={(value) => setForm((current) => ({ ...current, gisServerId: value }))}
          options={servers}
          getOptionLabel={(item) => item.name || item.code}
          getOptionValue={(item) => item.id}
        />
        <TextField size="small" label="Code" value={form.code} onChange={(event) => setForm((current) => ({ ...current, code: event.target.value }))} />
        <TextField size="small" label="Label" value={form.label} onChange={(event) => setForm((current) => ({ ...current, label: event.target.value }))} />
        <TextField size="small" label="GeoServer layer group name" value={form.gsLayerGroupName} onChange={(event) => setForm((current) => ({ ...current, gsLayerGroupName: event.target.value }))} helperText="Optional. Defaults to workspace:code when synced." />
        <FormControlLabel control={<Checkbox checked={form.defaultVisible} onChange={(event) => setForm((current) => ({ ...current, defaultVisible: event.target.checked }))} />} label="Visible by default" />
        <FormControlLabel control={<Checkbox checked={form.syncToGeoServer} onChange={(event) => setForm((current) => ({ ...current, syncToGeoServer: event.target.checked }))} />} label="Sync to GeoServer on save" />
        <Typography variant="overline">Members</Typography>
        <Box sx={{ maxHeight: 280, overflow: 'auto', border: 1, borderColor: 'divider', borderRadius: 1, p: 1 }}>
          {layers.filter((layer) => String(layer.gisServerId) === String(form.gisServerId)).map((layer) => (
            <FormControlLabel
              key={layer.id}
              control={<Checkbox size="small" checked={form.members.some((member) => Number(member.mapLayerId) === Number(layer.id))} onChange={() => toggleMember(layer.id)} />}
              label={`${layer.label} (${layer.wmsLayers})`}
            />
          ))}
        </Box>
        <IconAction label={busy ? 'Saving…' : 'Save group'} icon={<SaveOutlinedIcon fontSize="small" />} variant="contained" disabled={busy || !form.code || !form.label} onClick={save} />
      </Stack>
    </ExerciseLayout>
  )
}

export function MapStylesPage() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const servers = useServers()
  const [serverId, setServerId] = useState('')
  const [styles, setStyles] = useState(EMPTY_LIST)
  const [name, setName] = useState('')
  const [sldXml, setSldXml] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!serverId && servers.length) setServerId(String((servers.find((item) => item.defaultServer) || servers[0]).id))
  }, [servers, serverId])

  const load = useCallback(async () => {
    if (!serverId) return
    try {
      setStyles(await get('/map/styles', { gisServerId: serverId }) || EMPTY_LIST)
    } catch {
      setStyles(EMPTY_LIST)
    }
  }, [serverId])

  useEffect(() => { load() }, [load])

  const upload = async () => {
    setBusy(true)
    try {
      await post('/map/styles', { gisServerId: Number(serverId), name, sldXml })
      push('Style uploaded.', 'success')
      setName('')
      setSldXml('')
      await load()
    } catch (error) {
      push(error?.message || 'Upload failed.', 'error')
    } finally {
      setBusy(false)
    }
  }

  return (
    <ExerciseLayout>
      <Stack spacing={1.5}>
        <SearchSelect
          size="small"
          label="GIS server"
          value={serverId}
          onChange={setServerId}
          options={servers}
          getOptionLabel={(item) => item.name || item.code}
          getOptionValue={(item) => item.id}
        />
        <TextField size="small" label="Style name" value={name} onChange={(event) => setName(event.target.value)} />
        <TextField size="small" label="SLD XML" value={sldXml} onChange={(event) => setSldXml(event.target.value)} multiline minRows={8} />
        <Button variant="contained" disabled={busy || !name.trim() || !sldXml.trim()} onClick={upload}>Upload SLD</Button>
        <Typography variant="overline">Uploaded styles</Typography>
        {styles.map((style) => (
          <Typography key={style.id} variant="body2">{style.name} ({style.workspace})</Typography>
        ))}
      </Stack>
    </ExerciseLayout>
  )
}
