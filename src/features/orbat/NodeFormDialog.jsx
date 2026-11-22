import { useEffect, useMemo, useRef, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField } from '@mui/material'
import { IconField } from '../../shared/ui/IconPicker'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { locationStartAdornment, useSharedMapPick } from '../../shared/map/PickOnMap'
import { useLocationPick } from '../../shared/map/useLocationPick'
import { allowedChildren, canSitUnder, fieldsOf, typeCode } from './nodeRules'

function emptyValues(type, preset) {
  const values = { name: preset?.name || '', nodeTypeId: type?.id ?? preset?.nodeTypeId ?? '' }
  fieldsOf(type).forEach((field) => {
    values[field.key] = preset?.[field.key] ?? ''
  })
  return values
}

/** One form for adding or editing a node. Fields come from the node type catalogue. */
export function NodeFormDialog({
  open,
  title,
  types = [],
  parent,
  initial,
  preset,
  presetTypeId,
  iconTheme,
  hierarchy = null,
  sides = null,
  sideId = '',
  onSideChange,
  onClose,
  onSubmit,
}) {
  const [typeId, setTypeId] = useState('')
  const [underId, setUnderId] = useState('')
  const [iconPath, setIconPath] = useState('')
  const [values, setValues] = useState({ name: '' })
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const type = types.find((item) => String(item.id) === String(typeId)) || null
  const tree = Array.isArray(hierarchy) ? hierarchy : null
  const underNode = tree?.find((node) => node.id === underId) || null
  const typeOfNode = (node) => types.find((item) => String(item.id) === String(node?.nodeTypeId)) || null
  const parentType = types.find((item) => String(item.id) === String((underNode || parent)?.nodeTypeId)) || null
  const choices = useMemo(() => {
    if (initial) return types.filter((item) => String(item.id) === String(initial.nodeTypeId))
    if (tree) {
      if (underNode) return allowedChildren(types, typeOfNode(underNode))
      return types.filter((item) => tree.some((node) => canSitUnder(item, typeCode(typeOfNode(node)))))
    }
    return allowedChildren(types, parentType)
  }, [types, parentType, initial, tree, underNode])
  const underOptions = useMemo(() => {
    if (!tree) return []
    if (!type) return tree
    return tree.filter((node) => canSitUnder(type, typeCode(typeOfNode(node))))
  }, [tree, type, types])
  const rootEdit = Boolean(initial && !initial.parentId)

  const wasOpen = useRef(false)
  useEffect(() => {
    const opening = open && !wasOpen.current
    wasOpen.current = open
    if (!opening) return
    const hinted = parent
    const hintedType = types.find((item) => String(item.id) === String(hinted?.nodeTypeId))
    const startChoices = initial
      ? types.filter((item) => String(item.id) === String(initial.nodeTypeId))
      : hinted
        ? allowedChildren(types, hintedType)
        : choices
    const startId = initial?.nodeTypeId || presetTypeId || startChoices[0]?.id || ''
    const start = types.find((item) => String(item.id) === String(startId))
    setTypeId(startId === '' ? '' : String(startId))
    setUnderId(initial?.parentId || parent?.id || '')
    setIconPath(initial?.iconPath || start?.iconPath || '')
    const next = emptyValues(start, initial || preset)
    if (!initial && parent && start?.code === 'GOC') {
      next.formation_type = typeCode(parent).toLowerCase()
      next.formation_id = parent.id
    }
    setValues(next)
    setError('')
  }, [open, initial, preset, presetTypeId, parent, choices, types])

  const setField = (key, value) => setValues((current) => ({ ...current, [key]: value }))
  const picking = useLocationPick((state) => state.armed)
  const locationOwner = useSharedMapPick((point) => setValues((current) => ({
    ...current,
    latitude: point.latitude,
    longitude: point.longitude,
  })))

  const submit = async () => {
    if (!type) {
      setError('Choose a node type.')
      return
    }
    if (!String(values.name || '').trim()) {
      setError('Enter a name.')
      return
    }
    if (tree && !rootEdit && !underId) {
      setError('Choose where this sits in the hierarchy.')
      return
    }
    const node = { ...values, name: String(values.name).trim(), nodeTypeId: type.id, iconPath: iconPath || null }
    if (tree && !rootEdit) node.parentId = underId || null
    fieldsOf(type).forEach((field) => {
      const raw = node[field.key]
      if (field.type === 'number') node[field.key] = raw === '' || raw == null ? null : Number(raw)
      else if (raw === '') node[field.key] = null
    })
    setBusy(true)
    setError('')
    try {
      await onSubmit(node)
    } catch (failure) {
      setError(failure?.message || 'The node could not be saved.')
    } finally {
      setBusy(false)
    }
  }

  const catalogue = fieldsOf(type)
  const latitude = catalogue.find((field) => field.key === 'latitude')
  const longitude = catalogue.find((field) => field.key === 'longitude')
  const otherFields = catalogue.filter((field) => field.key !== 'latitude' && field.key !== 'longitude')

  return (
    <Dialog
      open={open && !picking}
      keepMounted
      hideBackdrop={picking}
      onClose={(event, reason) => {
        if (picking && reason === 'escapeKeyDown') {
          useLocationPick.getState().disarm()
          return
        }
        if (!busy) onClose()
      }}
      fullWidth
      maxWidth="xs"
      component="form"
      onSubmit={(event) => { event.preventDefault(); submit() }}
      sx={picking ? { pointerEvents: 'none' } : undefined}
      slotProps={{ paper: { sx: picking ? { visibility: 'hidden' } : undefined } }}
    >
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={1.25} sx={{ pt: 1 }}>
          {choices.length ? null : <TextField error size="small" value="This node has no type yet, so nothing can be added under it. Edit it and choose a type first." slotProps={{ input: { readOnly: true } }} />}
          {sides?.length ? (
            <SearchSelect
              required
              size="small"
              label="Side"
              options={sides}
              value={sideId}
              onChange={onSideChange}
              getOptionLabel={(item) => item.name}
              getOptionValue={(item) => String(item.id)}
            />
          ) : null}
          <SearchSelect
            required
            size="small"
            label="Node Type"
            options={choices}
            value={choices.some((item) => String(item.id) === String(typeId)) ? typeId : ''}
            disabled={Boolean(initial?.nodeTypeId) || !choices.length}
            onChange={(id) => {
              const next = types.find((item) => String(item.id) === String(id))
              setTypeId(id)
              setIconPath(next?.iconPath || '')
              setValues(emptyValues(next, { ...values, nodeTypeId: next?.id }))
              const stayed = tree?.find((node) => node.id === underId)
              if (next && stayed && !canSitUnder(next, typeCode(typeOfNode(stayed)))) setUnderId('')
            }}
            getOptionLabel={(item) => item.name}
            getOptionValue={(item) => String(item.id)}
          />
          {tree && !rootEdit ? (
            <SearchSelect
              required
              size="small"
              label="Under"
              options={underOptions}
              value={underOptions.some((node) => node.id === underId) ? underId : ''}
              onChange={setUnderId}
              getOptionLabel={(node) => `${node.name}${typeOfNode(node)?.name ? ` · ${typeOfNode(node).name}` : ''}`}
              getOptionValue={(node) => node.id}
            />
          ) : null}
          <IconField label="Icon" value={iconPath} onChange={setIconPath} theme={iconTheme} />
          <TextField required size="small" label="Name" value={values.name || ''} onChange={(event) => setField('name', event.target.value)} />
          {latitude ? (
            <TextField
              required={latitude.required}
              size="small"
              type="number"
              label={latitude.label}
              value={values.latitude ?? ''}
              onChange={(event) => setField('latitude', event.target.value)}
              slotProps={{ input: { startAdornment: locationStartAdornment(locationOwner) } }}
            />
          ) : null}
          {longitude ? (
            <TextField
              required={longitude.required}
              size="small"
              type="number"
              label={longitude.label}
              value={values.longitude ?? ''}
              onChange={(event) => setField('longitude', event.target.value)}
              slotProps={{ input: { startAdornment: locationStartAdornment(locationOwner) } }}
            />
          ) : null}
          {otherFields.map((field) => field.type === 'choice' ? (
            <SearchSelect
              key={field.key}
              required={field.required}
              size="small"
              label={field.label}
              clearLabel={field.required ? undefined : 'None'}
              options={(field.options || []).map((option) => ({ id: option, name: String(option).replaceAll('_', ' ') }))}
              value={values[field.key] ?? ''}
              onChange={(id) => setField(field.key, id)}
              getOptionLabel={(option) => option.name}
              getOptionValue={(option) => option.id}
            />
          ) : (
            <TextField
              key={field.key}
              required={field.required}
              size="small"
              type={field.type === 'number' ? 'number' : 'text'}
              label={field.label}
              value={values[field.key] ?? ''}
              helperText={field.key === 'potential' && !field.required ? 'Leave empty to sum the children' : undefined}
              onChange={(event) => setField(field.key, event.target.value)}
            />
          ))}
          {error ? <TextField error value={error} size="small" slotProps={{ input: { readOnly: true } }} /> : null}
        </Stack>
      </DialogContent>
      <DialogActions>
        <Button onClick={onClose} disabled={busy}>Cancel</Button>
        <Button type="submit" variant="contained" disabled={busy || !typeId || (tree && !rootEdit && !underId)}>{busy ? 'Saving' : 'Done'}</Button>
      </DialogActions>
    </Dialog>
  )
}
