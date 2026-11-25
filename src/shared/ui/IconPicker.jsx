import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  InputAdornment,
  Paper,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import SearchOutlinedIcon from '@mui/icons-material/SearchOutlined'
import CheckCircleRoundedIcon from '@mui/icons-material/CheckCircleRounded'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import ClearOutlinedIcon from '@mui/icons-material/ClearOutlined'
import CloseIcon from '@mui/icons-material/Close'
import ImageOutlinedIcon from '@mui/icons-material/ImageOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { useSessionStore } from '../../features/session/useSessionStore'
import { FunctionalityCodes, hasFunctionality } from '../auth/functionalityCodes'
import { listAssets, setAssetLabel } from '../api/assets'
import { useTheme } from '@mui/material/styles'
import { httpBlob, httpText } from '../api/http'
import { iconCssVars } from '../icons/iconTheme'
import { isSvgPath, sanitizeToNode } from '../icons/svgDocument'
import { IconAction } from './IconAction'

const previews = new Map()
const previewListeners = new Set()
let previewEpoch = 0

function readPreview(path) {
  const entry = previews.get(path)
  return entry && typeof entry === 'object' ? entry : null
}

function usePreviewEpoch() {
  const [epoch, setEpoch] = useState(previewEpoch)
  useEffect(() => {
    const listener = (value) => setEpoch(value)
    previewListeners.add(listener)
    return () => previewListeners.delete(listener)
  }, [])
  return epoch
}

/** Drops a cached preview so the next paint reads the file again. */
export function forgetIconPreview(path) {
  const cached = previews.get(path)
  if (cached?.kind === 'image' && cached.url) URL.revokeObjectURL(cached.url)
  previews.delete(path)
  previewEpoch += 1
  previewListeners.forEach((listener) => listener(previewEpoch))
}

/** SVG is inlined so var(--wp-*) paints follow the active theme. Raster files stay images. */
export function IconPreview({ path, size = 32, alt = '', theme: themeOverride = null }) {
  const viewerTheme = useTheme()
  const theme = themeOverride || viewerTheme
  const epoch = usePreviewEpoch()
  const hostRef = useRef(null)
  const [entry, setEntry] = useState(() => (path ? readPreview(path) : null))
  const [failed, setFailed] = useState(false)

  useEffect(() => {
    if (!path) return undefined
    const cached = readPreview(path)
    if (cached) {
      setEntry(cached)
      setFailed(false)
      return undefined
    }
    let live = true
    setEntry(null)
    setFailed(false)
    const done = (next) => {
      previews.set(path, next)
      if (live) {
        setEntry(next)
        setFailed(false)
      }
    }
    const request = isSvgPath(path)
      ? httpText('/assets/content', { query: { path } }).then((markup) => done({ kind: 'svg', markup }))
      : httpBlob('/assets/content', { query: { path } }).then((blob) => done({ kind: 'image', url: URL.createObjectURL(blob) }))
    request.catch(() => {
      if (live) setFailed(true)
    })
    return () => {
      live = false
    }
  }, [path, epoch])

  useEffect(() => {
    const host = hostRef.current
    if (!host) return undefined
    host.replaceChildren()
    if (entry?.kind === 'svg') {
      const node = sanitizeToNode(entry.markup)
      if (node) host.appendChild(node)
    }
    return undefined
  }, [entry])

  const box = { width: size, height: size, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }
  if (!path || failed || !entry) {
    return <Box sx={{ ...box, border: 1, borderColor: 'divider', borderRadius: 0.5, color: 'text.disabled', fontSize: 10 }} aria-hidden>{failed ? '!' : ''}</Box>
  }
  if (entry.kind === 'image') {
    return <Box component="img" src={entry.url} alt={alt} sx={{ ...box, objectFit: 'contain' }} />
  }
  return (
    <Box
      ref={hostRef}
      role={alt ? 'img' : undefined}
      aria-label={alt || undefined}
      aria-hidden={alt ? undefined : true}
      sx={{
        ...box,
        ...iconCssVars(theme),
        color: 'text.primary',
        overflow: 'hidden',
        lineHeight: 0,
        '& svg': { width: '100%', height: '100%', display: 'block' },
      }}
    />
  )
}

function fileNameOf(path) {
  const text = String(path || '')
  const slash = text.lastIndexOf('/')
  return slash >= 0 ? text.slice(slash + 1) : text
}

/** Lists icon assets only. The label is the same for every user. */
export function IconPicker({ open, value = '', onClose, onSelect, theme = null }) {
  const canEdit = useSessionStore((state) => hasFunctionality(state.session?.functionalities, FunctionalityCodes.MANAGE_ICONS))
  const [files, setFiles] = useState(null)
  const [chosen, setChosen] = useState(value)
  const [query, setQuery] = useState('')
  const [labelDraft, setLabelDraft] = useState('')
  const [savingLabel, setSavingLabel] = useState(false)
  const [error, setError] = useState('')

  const load = useCallback(async () => {
    setError('')
    try {
      const rows = await listAssets('icon')
      setFiles(Array.isArray(rows) ? rows : [])
    } catch (failure) {
      setError(failure?.message || 'The icons could not be listed.')
      setFiles([])
    }
  }, [])

  useEffect(() => {
    if (!open) return
    setChosen(value)
    load()
  }, [open, value, load])

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase()
    const rows = files || []
    if (!q) return rows
    return rows.filter((file) => `${file.label || ''} ${file.name || ''} ${file.path || ''}`.toLowerCase().includes(q))
  }, [files, query])
  const chosenFile = useMemo(() => (files || []).find((file) => file.path === chosen) || null, [files, chosen])

  useEffect(() => {
    setLabelDraft(chosenFile?.label || '')
  }, [chosenFile])

  async function saveLabel() {
    const next = labelDraft.trim()
    if (!chosenFile?.id || !next) {
      setError('A label is required.')
      return
    }
    setSavingLabel(true)
    setError('')
    try {
      await setAssetLabel(chosenFile.id, next)
      invalidateIconLabels()
      await load()
    } catch (failure) {
      setError(failure?.message || 'The label could not be saved.')
    } finally {
      setSavingLabel(false)
    }
  }

  return (
    <Dialog open={open} onClose={onClose} fullWidth maxWidth="md" slotProps={{ paper: { sx: { borderRadius: 3, overflow: 'hidden' } } }}>
      <DialogTitle sx={{ pb: 0.5 }}>
        Choose an icon
      </DialogTitle>
      <DialogContent dividers sx={{ p: 0 }}>
        {error ? <Alert severity="error" sx={{ m: 2, mb: 0, borderRadius: 2 }}>{error}</Alert> : null}
        {!files && !error ? (
          <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 1.5, minHeight: 280, color: 'text.secondary' }}>
            <CircularProgress size={20} />
            <Typography variant="body2">Loading icons…</Typography>
          </Box>
        ) : null}
        {files ? (
          <Box sx={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
            <Box sx={{ p: 1.5, pb: 1 }}>
              <TextField
                size="small"
                fullWidth
                placeholder="Search icons"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                slotProps={{ input: { startAdornment: (<InputAdornment position="start"><SearchOutlinedIcon fontSize="small" color="disabled" /></InputAdornment>) } }}
              />
            </Box>
            <Box sx={{ px: 1.5, pb: 1.5, overflow: 'auto', maxHeight: 360, minHeight: 184 }}>
              {visible.length ? (
                <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(94px, 1fr))', gap: 1.25 }}>
                  {visible.map((file) => {
                    const selected = chosen === file.path
                    return (
                      <Button
                        key={file.id || file.path}
                        disableRipple
                        onClick={() => setChosen(file.path)}
                        onDoubleClick={() => onSelect(file.path)}
                        aria-pressed={selected}
                        title={file.label || file.name}
                        sx={{
                          position: 'relative',
                          flexDirection: 'column',
                          gap: 0.75,
                          p: 1,
                          minHeight: 100,
                          textTransform: 'none',
                          borderRadius: 2,
                          border: 2,
                          borderColor: selected ? 'primary.main' : 'divider',
                          bgcolor: selected ? 'action.selected' : 'background.paper',
                          color: 'text.primary',
                        }}
                      >
                        {selected ? <CheckCircleRoundedIcon sx={{ position: 'absolute', top: 4, right: 4, fontSize: 18, color: 'primary.main' }} /> : null}
                        <IconPreview path={file.path} size={40} alt={file.label || file.name} theme={theme} />
                        <Typography variant="caption" noWrap sx={{ maxWidth: '100%', fontWeight: selected ? 600 : 400 }}>{file.label || file.name}</Typography>
                      </Button>
                    )
                  })}
                </Box>
              ) : (
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 1, minHeight: 184, color: 'text.secondary', textAlign: 'center' }}>
                  <ImageOutlinedIcon sx={{ fontSize: 36, opacity: 0.5 }} />
                  <Typography variant="body2">{query ? 'No icons match your search.' : 'No icons yet.'}</Typography>
                </Box>
              )}
            </Box>
            {chosenFile && canEdit ? (
              <Paper variant="outlined" sx={{ m: 1.5, mt: 0, p: 1.25, borderRadius: 2, bgcolor: 'background.default' }}>
                <Stack direction="row" spacing={1} alignItems="center">
                  <TextField size="small" label="Label" value={labelDraft} onChange={(event) => setLabelDraft(event.target.value)} error={!labelDraft.trim()} fullWidth />
                  <IconAction
                    label={savingLabel ? 'Saving' : 'Save'}
                    icon={<SaveOutlinedIcon fontSize="small" />}
                    disabled={savingLabel || !labelDraft.trim()}
                    onClick={saveLabel}
                    variant="contained"
                  />
                </Stack>
              </Paper>
            ) : null}
          </Box>
        ) : null}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, justifyContent: 'space-between' }}>
        <Typography variant="body2" noWrap sx={{ minWidth: 0 }}>{chosenFile ? (chosenFile.label || fileNameOf(chosen)) : 'Nothing chosen'}</Typography>
        <Stack direction="row" spacing={1}>
          {value ? (
            <IconAction label="Clear" icon={<ClearOutlinedIcon fontSize="small" />} onClick={() => onSelect('')} />
          ) : null}
          <IconAction label="Cancel" icon={<CloseIcon fontSize="small" />} onClick={onClose} />
          <IconAction
            label="Use icon"
            icon={<CheckOutlinedIcon fontSize="small" />}
            disabled={!chosen}
            onClick={() => onSelect(chosen)}
            variant="contained"
          />
        </Stack>
      </DialogActions>
    </Dialog>
  )
}

let iconLabelCache = null
let iconLabelPromise = null

export function invalidateIconLabels() {
  iconLabelCache = null
  iconLabelPromise = null
}

function loadIconLabels(force = false) {
  if (iconLabelCache && !force) return Promise.resolve(iconLabelCache)
  if (iconLabelPromise && !force) return iconLabelPromise
  iconLabelPromise = listAssets('icon')
    .then((rows) => {
      const map = {}
      ;(Array.isArray(rows) ? rows : []).forEach((row) => {
        if (row?.path) map[row.path] = row.label || row.name || ''
      })
      iconLabelCache = map
      return map
    })
    .catch(() => {
      iconLabelCache = {}
      return iconLabelCache
    })
    .finally(() => {
      iconLabelPromise = null
    })
  return iconLabelPromise
}

/** A small button that shows the chosen icon and the shared label. */
export function IconField({ value, onChange, label = 'Icon', theme = null }) {
  const [open, setOpen] = useState(false)
  const [labels, setLabels] = useState(iconLabelCache)

  useEffect(() => {
    let live = true
    loadIconLabels().then((map) => {
      if (live) setLabels(map)
    })
    return () => {
      live = false
    }
  }, [])

  const display = value ? (labels && labels[value]) || fileNameOf(value) : ''
  return (
    <>
      <Stack direction="row" spacing={1} alignItems="center">
        {value ? <IconPreview path={value} size={20} theme={theme} /> : null}
        {value ? <Typography variant="body2" noWrap sx={{ maxWidth: 160 }}>{display}</Typography> : null}
        <IconAction
          label={value ? `Change ${label.toLowerCase()}` : `Choose ${label.toLowerCase()}`}
          icon={<ImageOutlinedIcon fontSize="small" />}
          onClick={() => setOpen(true)}
        />
      </Stack>
      <IconPicker
        open={open}
        value={value}
        theme={theme}
        onClose={() => setOpen(false)}
        onSelect={(path) => {
          onChange(path)
          setOpen(false)
          loadIconLabels(true).then((map) => setLabels({ ...map }))
        }}
      />
    </>
  )
}
