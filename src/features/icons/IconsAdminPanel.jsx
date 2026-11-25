import { useCallback, useEffect, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import DrawOutlinedIcon from '@mui/icons-material/DrawOutlined'
import GestureIcon from '@mui/icons-material/Gesture'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import UploadFileOutlinedIcon from '@mui/icons-material/UploadFileOutlined'
import {
  deleteAsset,
  getAssetSettings,
  listAssets,
  replaceApplicationPicture,
  setAssetLabel,
  updateAssetSettings,
  uploadAsset,
} from '../../shared/api/assets'
import { FunctionalityCodes, hasFunctionality } from '../../shared/auth/functionalityCodes'
import { isSvgPath } from '../../shared/icons/svgDocument'
import { logger } from '../../shared/lib/logger'
import { IconAction } from '../../shared/ui/IconAction'
import { LoadingState } from '../../shared/ui/LoadingState'
import { IconPreview, forgetIconPreview, invalidateIconLabels } from '../../shared/ui/IconPicker'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { ExerciseLayout } from '../scenario/ExerciseLayout'
import { IconStudio } from './IconStudio'

const SECTIONS = [
  { id: 'icon', label: 'Icons', accept: '.svg,.png' },
  { id: 'image', label: 'Images', accept: '.png,.jpg,.jpeg,.gif,.webp' },
  { id: 'document', label: 'Documents', accept: '.txt,.doc,.docx,.pdf' },
  { id: 'application', label: 'Application', accept: '' },
]

const SLOTS = [
  { id: 'logo', label: 'Logo', accept: '.svg,.png' },
  { id: 'favicon', label: 'Favicon', accept: '.svg,.png' },
  { id: 'login-background', label: 'Login picture', accept: '.svg,.png,.jpg,.jpeg,.webp' },
]

export function IconsAdminPanel() {
  const push = useToastStore((state) => state.push)
  const canManage = useSessionStore((state) => hasFunctionality(state.session?.functionalities, FunctionalityCodes.MANAGE_ICONS))
  const [section, setSection] = useState('icon')
  const [settings, setSettings] = useState(null)
  const [pathDraft, setPathDraft] = useState('')
  const [limits, setLimits] = useState({ iconMaxBytes: '', imageMaxBytes: '', documentMaxBytes: '' })
  const [rows, setRows] = useState([])
  const [chosen, setChosen] = useState(null)
  const [labelDraft, setLabelDraft] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const [studio, setStudio] = useState(null)
  const [busy, setBusy] = useState(false)
  const uploadRef = useRef(null)
  const replaceRefs = useRef({})

  const loadSettings = useCallback(async () => {
    const next = await getAssetSettings()
    setSettings(next)
    setPathDraft(next?.path || '')
    setLimits({
      iconMaxBytes: String(next?.iconMaxBytes ?? ''),
      imageMaxBytes: String(next?.imageMaxBytes ?? ''),
      documentMaxBytes: String(next?.documentMaxBytes ?? ''),
    })
    return next
  }, [])

  const loadRows = useCallback(async (kind) => {
    if (kind === 'application') {
      setRows([])
      return
    }
    const list = await listAssets(kind)
    setRows(Array.isArray(list) ? list : [])
  }, [])

  const load = useCallback(async () => {
    setError('')
    setLoading(true)
    try {
      await loadSettings()
      await loadRows(section)
    } catch (failure) {
      const text = failure?.message || 'The assets could not be loaded.'
      setError(text)
      logger.warn('assets.load_failed', { message: text })
    } finally {
      setLoading(false)
    }
  }, [loadRows, loadSettings, section])

  useEffect(() => {
    load()
  }, [load])

  useEffect(() => {
    setLabelDraft(chosen?.label || '')
  }, [chosen])

  async function saveSettings() {
    const iconMaxBytes = Number(limits.iconMaxBytes)
    const imageMaxBytes = Number(limits.imageMaxBytes)
    const documentMaxBytes = Number(limits.documentMaxBytes)
    if (!pathDraft.trim() || !iconMaxBytes || !imageMaxBytes || !documentMaxBytes) {
      setError('The folder and all three size limits are required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await updateAssetSettings({ path: pathDraft.trim(), iconMaxBytes, imageMaxBytes, documentMaxBytes })
      push('Asset settings saved.', 'success')
      await load()
    } catch (failure) {
      const text = failure?.message || 'The asset settings could not be saved.'
      setError(text)
      push(text, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onUpload(file, kind) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await uploadAsset(file, kind)
      invalidateIconLabels()
      push('File stored.', 'success')
      await loadRows(kind)
    } catch (failure) {
      const text = failure?.message || 'The file could not be stored.'
      setError(text)
      push(text, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function onReplaceSlot(slot, file) {
    if (!file) return
    setBusy(true)
    setError('')
    try {
      await replaceApplicationPicture(slot, file)
      push('Picture updated.', 'success')
    } catch (failure) {
      const text = failure?.message || 'The picture could not be stored.'
      setError(text)
      push(text, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function saveLabel() {
    if (!chosen?.id || !labelDraft.trim()) {
      setError('A label is required.')
      return
    }
    setBusy(true)
    setError('')
    try {
      await setAssetLabel(chosen.id, labelDraft.trim())
      invalidateIconLabels()
      if (chosen.path) forgetIconPreview(chosen.path)
      push('Label saved.', 'success')
      await loadRows(section)
    } catch (failure) {
      const text = failure?.message || 'The label could not be saved.'
      setError(text)
      push(text, 'error')
    } finally {
      setBusy(false)
    }
  }

  async function remove(row) {
    setBusy(true)
    setError('')
    try {
      await deleteAsset(row.id)
      if (row.path) forgetIconPreview(row.path)
      invalidateIconLabels()
      setChosen(null)
      push('File removed.', 'success')
      await loadRows(section)
    } catch (failure) {
      const text = failure?.message || 'The file could not be removed.'
      setError(text)
      push(text, 'error')
    } finally {
      setBusy(false)
    }
  }

  if (loading && !settings) return <LoadingState label="Loading assets" />

  const current = SECTIONS.find((item) => item.id === section)

  return (
    <Stack spacing={2}>
      <Box sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
        <Stack spacing={1.5}>
          <TextField label="Base folder" value={pathDraft} onChange={(event) => setPathDraft(event.target.value)} disabled={!canManage || busy} fullWidth />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField label="Icon limit (bytes)" value={limits.iconMaxBytes} onChange={(event) => setLimits((current) => ({ ...current, iconMaxBytes: event.target.value }))} disabled={!canManage || busy} fullWidth />
            <TextField label="Image limit (bytes)" value={limits.imageMaxBytes} onChange={(event) => setLimits((current) => ({ ...current, imageMaxBytes: event.target.value }))} disabled={!canManage || busy} fullWidth />
            <TextField label="Document limit (bytes)" value={limits.documentMaxBytes} onChange={(event) => setLimits((current) => ({ ...current, documentMaxBytes: event.target.value }))} disabled={!canManage || busy} fullWidth />
          </Stack>
          {canManage ? (
            <IconAction label="Save settings" icon={<SaveOutlinedIcon fontSize="small" />} onClick={saveSettings} disabled={busy} variant="contained" />
          ) : null}
        </Stack>
      </Box>
      {error ? <Alert severity="error">{error}</Alert> : null}
      <Tabs value={section} onChange={(_event, value) => { setSection(value); setChosen(null) }}>
        {SECTIONS.map((item) => <Tab key={item.id} value={item.id} label={item.label} />)}
      </Tabs>
      {section === 'application' ? (
        <Stack spacing={1.5}>
          {SLOTS.map((slot) => (
            <Stack key={slot.id} direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ width: 140 }}>{slot.label}</Typography>
              {canManage ? (
                <>
                  <IconAction
                    label="Replace"
                    icon={<UploadFileOutlinedIcon fontSize="small" />}
                    disabled={busy}
                    onClick={() => replaceRefs.current[slot.id]?.click()}
                  />
                  <input
                    ref={(node) => { replaceRefs.current[slot.id] = node }}
                    hidden
                    type="file"
                    accept={slot.accept}
                    onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; onReplaceSlot(slot.id, file) }}
                  />
                </>
              ) : null}
            </Stack>
          ))}
        </Stack>
      ) : (
        <Stack spacing={1.5}>
          {canManage ? (
            <Stack direction="row" spacing={1}>
              <IconAction
                label="Upload"
                icon={<UploadFileOutlinedIcon fontSize="small" />}
                disabled={busy}
                onClick={() => uploadRef.current?.click()}
              />
              <input
                ref={uploadRef}
                hidden
                type="file"
                accept={current?.accept}
                onChange={(event) => { const file = event.target.files?.[0]; event.target.value = ''; onUpload(file, section) }}
              />
              {section === 'icon' ? (
                <IconAction
                  label="Draw icon"
                  icon={<GestureIcon fontSize="small" />}
                  onClick={() => setStudio({ mode: 'create' })}
                  variant="contained"
                />
              ) : null}
            </Stack>
          ) : null}
          <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 1 }}>
            {rows.map((row) => (
              <Button key={row.id} variant={chosen?.id === row.id ? 'contained' : 'outlined'} onClick={() => setChosen(row)} sx={{ flexDirection: 'column', minHeight: 96, textTransform: 'none' }}>
                {section === 'icon' || section === 'image' ? <IconPreview path={row.path} size={36} alt={row.label || row.name} /> : null}
                <Typography variant="caption" noWrap sx={{ maxWidth: '100%' }}>{row.label || row.name}</Typography>
              </Button>
            ))}
          </Box>
          {!rows.length ? <Typography variant="body2" color="text.secondary">Nothing stored in this section.</Typography> : null}
          {chosen ? (
            <Stack spacing={1} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 2 }}>
              <Typography variant="caption" color="text.secondary">{chosen.path}</Typography>
              <TextField label="Label" value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} disabled={!canManage || busy} fullWidth />
              {canManage ? (
                <Stack direction="row" spacing={1}>
                  <IconAction label="Save label" icon={<SaveOutlinedIcon fontSize="small" />} disabled={busy || !labelDraft.trim()} onClick={saveLabel} variant="contained" />
                  <IconAction label="Remove" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy} onClick={() => remove(chosen)} />
                  {section === 'icon' && isSvgPath(chosen.path) ? (
                    <IconAction
                      label="Revise as new"
                      icon={<DrawOutlinedIcon fontSize="small" />}
                      onClick={() => setStudio({ mode: 'revise', path: chosen.path, label: chosen.label || '' })}
                    />
                  ) : null}
                </Stack>
              ) : null}
            </Stack>
          ) : null}
        </Stack>
      )}
      <IconStudio
        open={Boolean(studio)}
        mode={studio?.mode || 'create'}
        path={studio?.path || ''}
        initialLabel={studio?.label || ''}
        onClose={() => setStudio(null)}
        onSaved={async () => { setStudio(null); await loadRows('icon') }}
      />
    </Stack>
  )
}

export function IconsPage() {
  return (
    <ExerciseLayout>
      <IconsAdminPanel />
    </ExerciseLayout>
  )
}

export default IconsAdminPanel
