import { useEffect, useState } from 'react'
import {
  Alert,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import CloseIcon from '@mui/icons-material/Close'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { IconField } from '../../shared/ui/IconPicker'
import { IconAction } from '../../shared/ui/IconAction'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { SideIconColorField, SIDE_ICON_COLOR_FALLBACK } from '../../shared/ui/SideIconColorField'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { asTheme, selectableThemes } from '../admin/themeChoices'

/** Runs an async submit, keeps the dialog open and shows the message when it fails. */
function useSubmit(onSubmit) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const run = async (...args) => {
    setBusy(true)
    setError('')
    try {
      await onSubmit(...args)
    } catch (failure) {
      setError(failure?.message || 'The change could not be made.')
    } finally {
      setBusy(false)
    }
  }
  return { busy, error, setError, run }
}

function Shell({ open, title, onClose, busy, error, submitLabel, submitIcon, submitDisabled, onSubmit, children, maxWidth = 'xs' }) {
  return (
    <Dialog open={open} onClose={busy ? undefined : onClose} fullWidth maxWidth={maxWidth} component="form" onSubmit={(event) => { event.preventDefault(); if (!submitDisabled) onSubmit() }}>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ pt: 1 }}>
          {children}
          {error ? <Alert severity="error">{error}</Alert> : null}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <IconAction label="Cancel" icon={<CloseIcon fontSize="small" />} onClick={onClose} disabled={busy} />
        <IconAction
          type="submit"
          label={busy ? 'Working' : submitLabel}
          icon={submitIcon || <SaveOutlinedIcon fontSize="small" />}
          variant="contained"
          disabled={busy || submitDisabled}
        />
      </DialogActions>
    </Dialog>
  )
}

/** Add a child (name + type) or rename (name only). */
export function NodeNameDialog({ open, title, submitLabel = 'Save', initialName = '', initialTypeId = '', nodeTypes = EMPTY_LIST, withType = false, onClose, onSubmit }) {
  const [name, setName] = useState(initialName)
  const [typeId, setTypeId] = useState(initialTypeId)
  const { busy, error, setError, run } = useSubmit(onSubmit)
  useEffect(() => {
    if (open) {
      setName(initialName)
      setTypeId(initialTypeId)
      setError('')
    }
  }, [open, initialName, initialTypeId, setError])
  return (
    <Shell open={open} title={title} onClose={onClose} busy={busy} error={error} submitLabel={submitLabel} submitIcon={<SaveOutlinedIcon fontSize="small" />} submitDisabled={!name.trim()} onSubmit={() => run({ name: name.trim(), nodeTypeId: typeId === '' ? null : typeId })}>
      <TextField autoFocus required label="Name" value={name} onChange={(event) => setName(event.target.value)} slotProps={{ htmlInput: { maxLength: 200 } }} />
      {withType ? (
        <SearchSelect
          label="Node Type"
          clearLabel="None"
          options={nodeTypes}
          value={typeId}
          onChange={setTypeId}
          getOptionLabel={(type) => type.name}
          getOptionValue={(type) => type.id}
        />
      ) : null}
    </Shell>
  )
}

/** Creates or updates a user bound to a saved standard ORBAT node. An empty theme inherits the side theme. */
export function MarkAsUserDialog({ open, node, user, roles = EMPTY_LIST, themes = EMPTY_LIST, onClose, onSubmit }) {
  const editing = Boolean(user)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [roleIds, setRoleIds] = useState([])
  const [themeId, setThemeId] = useState('')
  const { busy, error, setError, run } = useSubmit(onSubmit)
  const free = selectableThemes(themes, 'USER', user?.id ?? null)
  useEffect(() => {
    if (open) {
      setName(user?.name || node?.name || '')
      setPassword('')
      setRoleIds(Array.isArray(user?.roleIds) ? user.roleIds : [])
      setThemeId(user?.themeId == null || user?.themeId === '' ? '' : String(user.themeId))
      setError('')
    }
  }, [open, node, user, setError])
  const passwordOk = editing ? password.length === 0 || password.length >= 3 : password.length >= 3
  return (
    <Shell
      open={open}
      title={editing ? 'Update User' : 'Mark as User'}
      submitLabel={editing ? 'Save User' : 'Create User'}
      submitIcon={editing ? <SaveOutlinedIcon fontSize="small" /> : <AddIcon fontSize="small" />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitDisabled={!name.trim() || !passwordOk || !roleIds.length}
      onSubmit={() => run({ name: name.trim(), password, roleIds, themeId: themeId === '' ? null : Number(themeId) })}
    >
      <TextField autoFocus required label="User Name" value={name} onChange={(event) => setName(event.target.value)} autoComplete="off" />
      <TextField required={!editing} type="password" label={editing ? 'New password' : 'Password'} value={password} onChange={(event) => setPassword(event.target.value)} helperText={editing ? undefined : 'At least 3 characters'} autoComplete="new-password" />
      <SearchSelect
        label="Override Theme"
        clearLabel="Inherit the side theme"
        options={free}
        value={themeId}
        onChange={setThemeId}
        getOptionLabel={(theme) => theme.name}
        getOptionValue={(theme) => String(theme.id)}
      />
      <SearchSelect
        multiple
        required
        label="Roles"
        options={roles}
        value={roleIds}
        onChange={setRoleIds}
        getOptionLabel={(role) => role.name}
        getOptionValue={(role) => role.id}
        noOptionsText="No roles are available to you."
      />
    </Shell>
  )
}

/** Creates a country side and the standard ORBAT root in one step. */
export function ForceDialog({ open, themes = EMPTY_LIST, onClose, onSubmit }) {
  const [name, setName] = useState('')
  const [colour, setColour] = useState(SIDE_ICON_COLOR_FALLBACK)
  const [icon, setIcon] = useState('')
  const [themeId, setThemeId] = useState('')
  const { busy, error, setError, run } = useSubmit(onSubmit)
  const free = selectableThemes(themes, 'SIDE', null)
  useEffect(() => {
    if (open) {
      setName('')
      setColour(SIDE_ICON_COLOR_FALLBACK)
      setIcon('')
      setThemeId('')
      setError('')
    }
  }, [open, setError])
  return (
    <Shell
      open={open}
      title="New Side"
      submitLabel="Create Side"
      submitIcon={<AddIcon fontSize="small" />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitDisabled={!name.trim() || !themeId}
      onSubmit={() => run({ name: name.trim(), colour, icon: icon || null, themeId: Number(themeId), description: '' })}
    >
      <TextField autoFocus required label="Side Name" value={name} onChange={(event) => setName(event.target.value)} />
      <SideIconColorField colour={colour} onChange={setColour} />
      <IconField value={icon} onChange={setIcon} />
      <SearchSelect
        required
        label="Theme"
        options={free}
        value={themeId}
        onChange={setThemeId}
        getOptionLabel={(theme) => theme.name}
        getOptionValue={(theme) => String(theme.id)}
        noOptionsText="No free theme is left. Create one in Themes first."
      />
      {free.length ? null : <Typography variant="caption" color="text.secondary">No free theme is left. Create one in Themes first.</Typography>}
    </Shell>
  )
}

/** Adds one playing side: a single country, or an alliance of countries. */
export function PlayingSideDialog({
  open,
  sides = EMPTY_LIST,
  themes = EMPTY_LIST,
  allowSingle = true,
  allowAlliance = true,
  onClose,
  onSingle,
  onAlliance,
}) {
  const [kind, setKind] = useState('single')
  const [sideId, setSideId] = useState('')
  const [name, setName] = useState('')
  const [colour, setColour] = useState(SIDE_ICON_COLOR_FALLBACK)
  const [icon, setIcon] = useState('')
  const [themeId, setThemeId] = useState('')
  const [members, setMembers] = useState([])
  const { busy, error, setError, run } = useSubmit(async (payload) => {
    if (payload.kind === 'single') await onSingle(payload.sideId)
    else await onAlliance(payload.body)
  })
  const free = selectableThemes(themes.map(asTheme), 'SIDE', null)
  const showChoice = allowSingle && allowAlliance

  useEffect(() => {
    if (!open) return
    setKind(allowSingle ? 'single' : 'alliance')
    setSideId(sides[0]?.id ?? '')
    setName('')
    setColour(SIDE_ICON_COLOR_FALLBACK)
    setIcon('')
    setThemeId('')
    setMembers([])
    setError('')
  }, [open, allowSingle, sides, setError])

  const single = kind === 'single'
  const submitDisabled = single ? sideId === '' : !name.trim() || members.length < 1 || themeId === ''

  return (
    <Shell
      open={open}
      title="New Side"
      submitLabel="Add Side"
      submitIcon={<AddIcon fontSize="small" />}
      onClose={onClose}
      busy={busy}
      error={error}
      submitDisabled={submitDisabled}
      onSubmit={() => run(single
        ? { kind: 'single', sideId }
        : { kind: 'alliance', body: { name: name.trim(), colour, icon: icon || null, themeId: themeId === '' ? null : Number(themeId), memberSideIds: members } })}
    >
      {showChoice ? (
        <ToggleButtonGroup
          exclusive
          fullWidth
          size="small"
          value={kind}
          onChange={(_, next) => {
            if (next) setKind(next)
          }}
          aria-label="Kind of side"
          sx={{ '& .MuiToggleButton-root': { textTransform: 'none' } }}
        >
          <ToggleButton value="single">Single Side</ToggleButton>
          <ToggleButton value="alliance">Alliance</ToggleButton>
        </ToggleButtonGroup>
      ) : null}
      {single ? (
        sides.length ? (
          <SearchSelect
            required
            label="Side"
            options={sides}
            value={sideId}
            onChange={setSideId}
            getOptionLabel={(side) => side.name}
            getOptionValue={(side) => side.id}
          />
        ) : (
          <Typography variant="body2" color="text.secondary">Every country side is already playing in this game.</Typography>
        )
      ) : (
        <>
          <TextField autoFocus required label="Alliance Name" value={name} onChange={(event) => setName(event.target.value)} />
          <SideIconColorField colour={colour} onChange={setColour} />
          <IconField value={icon} onChange={setIcon} />
          <SearchSelect
            required
            label="Theme"
            options={free}
            value={themeId}
            onChange={setThemeId}
            getOptionLabel={(theme) => theme.name}
            getOptionValue={(theme) => theme.id}
          />
          <SearchSelect
            multiple
            required
            label="Member Sides"
            options={sides}
            value={members}
            onChange={setMembers}
            getOptionLabel={(side) => side.name}
            getOptionValue={(side) => side.id}
            noOptionsText="Every country side is already playing in this game."
          />
        </>
      )}
    </Shell>
  )
}
