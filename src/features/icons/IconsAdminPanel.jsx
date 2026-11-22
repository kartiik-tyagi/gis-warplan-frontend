import { useCallback, useEffect, useMemo, useState } from 'react'
import {
  Alert,
  Box,
  Button,
  Chip,
  List,
  ListItemButton,
  ListItemText,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import FolderOutlinedIcon from '@mui/icons-material/FolderOutlined'
import GestureIcon from '@mui/icons-material/Gesture'
import { getAssetSettings, setIconLabel, updateAssetPath } from '../../shared/api/assets'
import { get } from '../../shared/api/http'
import { FunctionalityCodes, hasFunctionality } from '../../shared/auth/functionalityCodes'
import { isSvgPath } from '../../shared/icons/svgDocument'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { logger } from '../../shared/lib/logger'
import { LoadingState } from '../../shared/ui/LoadingState'
import { IconPreview } from '../../shared/ui/IconPicker'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { ExerciseLayout } from '../scenario/ExerciseLayout'
import { IconStudio } from './IconStudio'

function directories(node, depth = 0, found = []) {
  if (!node || node.type !== 'directory') return found
  found.push({ path: node.path || '', name: node.name || 'All icons', depth, children: node.children || EMPTY_LIST })
  ;(node.children || EMPTY_LIST).forEach((child) => directories(child, depth + 1, found))
  return found
}

/** Browse the icon folders and draw new SVG icons (drawing needs MANAGE_ICONS). */
export function IconsAdminPanel() {
  const push = useToastStore((state) => state.push)
  const canManage = useSessionStore((state) => hasFunctionality(state.session?.functionalities, FunctionalityCodes.MANAGE_ICONS))
  const [tree, setTree] = useState(null)
  const [folder, setFolder] = useState('')
  const [chosen, setChosen] = useState('')
  const [basePath, setBasePath] = useState('')
  const [basePathDraft, setBasePathDraft] = useState('')
  const [savingPath, setSavingPath] = useState(false)
  const [labelDraft, setLabelDraft] = useState('')
  const [savingLabel, setSavingLabel] = useState(false)
  const [error, setError] = useState('')
  const [studio, setStudio] = useState(null)

  const load = useCallback(async () => {
    setError('')
    // Load the stored base path first, so a bad folder (which makes /icons fail) is still shown and fixable.
    const settings = await getAssetSettings().catch(() => null)
    if (settings?.path != null) {
      setBasePath(settings.path)
      setBasePathDraft(settings.path)
    }
    try {
      setTree(await get('/icons'))
    } catch (failure) {
      const text = failure?.message || 'The icons could not be listed.'
      setError(text)
      push(text, 'error')
      logger.warn('icons.admin.list.failed', { message: text })
    }
  }, [push])

  useEffect(() => {
    load()
  }, [load])

  const folders = useMemo(() => directories(tree), [tree])
  const files = useMemo(() => {
    const current = folders.find((item) => item.path === folder)
    return (current?.children || EMPTY_LIST).filter((child) => child.type === 'file')
  }, [folders, folder])
  const chosenFile = useMemo(() => files.find((file) => file.path === chosen) || null, [files, chosen])

  useEffect(() => {
    setLabelDraft(chosenFile?.label || '')
  }, [chosenFile])

  const openFolder = (path) => {
    setFolder(path)
    setChosen('')
  }

  async function savePath() {
    const next = basePathDraft.trim()
    if (!next) {
      setError('The base icon folder is required.')
      push('The base icon folder is required.', 'error')
      return
    }
    setSavingPath(true)
    setError('')
    try {
      await updateAssetPath(next)
      logger.info('icons.admin.base_path.updated', { path: next })
      push('Base icon folder updated.', 'success')
      setFolder('')
      setChosen('')
      await load()
    } catch (failure) {
      const text = failure?.message || 'The base icon folder could not be changed.'
      setError(text)
      push(text, 'error')
      logger.warn('icons.admin.base_path.failed', { message: text })
    } finally {
      setSavingPath(false)
    }
  }

  async function saveLabel() {
    const next = labelDraft.trim()
    if (!chosen || !next) {
      setError('A label is required.')
      push('A label is required.', 'error')
      return
    }
    setSavingLabel(true)
    setError('')
    try {
      await setIconLabel(chosen, next)
      logger.info('icons.admin.label.saved', { path: chosen })
      push('Label saved.', 'success')
      await load()
    } catch (failure) {
      const text = failure?.message || 'The label could not be saved.'
      setError(text)
      push(text, 'error')
      logger.warn('icons.admin.label.failed', { message: text })
    } finally {
      setSavingLabel(false)
    }
  }

  async function onDrawn(savedPath) {
    setStudio(null)
    await load()
    if (!savedPath) return
    const parent = savedPath.includes('/') ? savedPath.slice(0, savedPath.lastIndexOf('/')) : ''
    setFolder(parent)
    setChosen(savedPath)
  }

  if (!tree && !error) return <LoadingState label="Loading icons" />

  return (
    <Stack spacing={2.5}>
      <Stack direction="row" spacing={1} useFlexGap sx={{ alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          Browse the icon folders. New icons are drawn here and stored on the server.
        </Typography>
        <Chip size="small" variant="outlined" label={canManage ? 'Can draw' : 'Read only'} />
      </Stack>

      <Box sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5} useFlexGap sx={{ alignItems: { sm: 'flex-start' } }}>
          <TextField
            label="Base icon folder"
            value={basePathDraft}
            onChange={(event) => setBasePathDraft(event.target.value)}
            disabled={!canManage || savingPath}
            error={canManage && !basePathDraft.trim()}
            helperText={canManage ? 'Folder the icon store reads from. Created if missing; must be writable.' : `Icons are read from ${basePath || '…'}.`}
            fullWidth
          />
          {canManage ? (
            <Button
              variant="outlined"
              disabled={savingPath || !basePathDraft.trim() || basePathDraft.trim() === basePath}
              onClick={savePath}
              sx={{ flexShrink: 0, mt: { sm: 1 } }}
            >
              {savingPath ? 'Saving…' : 'Save folder'}
            </Button>
          ) : null}
        </Stack>
      </Box>

      {error ? <Alert severity="error">{error}</Alert> : null}

      {tree ? (
        <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: '240px 1fr' }, gap: 2, alignItems: 'start' }}>
          <Box sx={{ border: 1, borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
            <Typography variant="subtitle2" sx={{ px: 2, py: 1.25, borderBottom: 1, borderColor: 'divider' }}>Folders</Typography>
            <List dense disablePadding aria-label="Icon folders" sx={{ maxHeight: 480, overflow: 'auto' }}>
              {folders.map((item) => (
                <ListItemButton key={item.path || 'root'} selected={item.path === folder} onClick={() => openFolder(item.path)} sx={{ pl: 2 + item.depth * 1.5 }}>
                  <FolderOutlinedIcon fontSize="small" sx={{ mr: 1, color: 'text.secondary' }} />
                  <ListItemText primary={item.name} slotProps={{ primary: { variant: 'body2', noWrap: true } }} />
                </ListItemButton>
              ))}
            </List>
          </Box>

          <Stack spacing={2} sx={{ minWidth: 0 }}>
            {files.length ? (
              <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(112px, 1fr))', gap: 1.25 }}>
                {files.map((file) => (
                  <Button
                    key={file.path}
                    variant={chosen === file.path ? 'contained' : 'outlined'}
                    color={chosen === file.path ? 'primary' : 'inherit'}
                    onClick={() => setChosen(file.path)}
                    aria-pressed={chosen === file.path}
                    sx={{ flexDirection: 'column', gap: 0.75, minHeight: 104, textTransform: 'none', borderRadius: 2, p: 1 }}
                  >
                    <IconPreview path={file.path} size={40} alt={file.label || file.name} />
                    <Typography variant="caption" noWrap sx={{ maxWidth: '100%' }}>{file.label || file.name}</Typography>
                  </Button>
                ))}
              </Box>
            ) : (
              <Box sx={{ py: 6, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
                <Typography variant="body2" color="text.secondary">No icons in {folder || 'the root folder'}.</Typography>
              </Box>
            )}

            {chosenFile ? (
              <Box sx={{ p: 2, borderRadius: 2, border: 1, borderColor: 'divider' }}>
                <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} sx={{ alignItems: { sm: 'flex-start' } }}>
                  <IconPreview path={chosenFile.path} size={64} alt={chosenFile.label || chosenFile.name} />
                  <Stack spacing={1} sx={{ flex: 1, minWidth: 0 }}>
                    <TextField
                      label="Label"
                      value={labelDraft}
                      onChange={(event) => setLabelDraft(event.target.value)}
                      disabled={!canManage || savingLabel}
                      error={canManage && !labelDraft.trim()}
                      helperText={canManage ? 'Shown in the picker instead of the file name.' : ' '}
                      fullWidth
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ wordBreak: 'break-all' }}>File: {chosenFile.path}</Typography>
                    {canManage ? (
                      <Stack direction="row" spacing={1}>
                        <Button
                          variant="outlined"
                          disabled={savingLabel || !labelDraft.trim() || labelDraft.trim() === (chosenFile.label || '')}
                          onClick={saveLabel}
                        >
                          {savingLabel ? 'Saving…' : 'Save label'}
                        </Button>
                        {isSvgPath(chosenFile.path) ? (
                          <Button variant="outlined" onClick={() => setStudio({ mode: 'revise', path: chosenFile.path, label: chosenFile.label || '' })}>
                            Revise
                          </Button>
                        ) : null}
                      </Stack>
                    ) : null}
                  </Stack>
                </Stack>
              </Box>
            ) : null}

            {canManage ? (
              <Button variant="contained" startIcon={<GestureIcon />} onClick={() => setStudio({ mode: 'create' })} sx={{ alignSelf: 'flex-start' }}>
                Draw icon
              </Button>
            ) : (
              <Typography variant="body2" color="text.secondary">Drawing icons needs the Manage icons permission.</Typography>
            )}
          </Stack>
        </Box>
      ) : null}
      <IconStudio
        open={Boolean(studio)}
        mode={studio?.mode || 'create'}
        directory={folder}
        path={studio?.path || ''}
        initialLabel={studio?.label || ''}
        onClose={() => setStudio(null)}
        onSaved={onDrawn}
      />
    </Stack>
  )
}

export function IconsPage() {
  return (
    <ExerciseLayout kicker="Records" title="Icons">
      <IconsAdminPanel />
    </ExerciseLayout>
  )
}

export default IconsAdminPanel
