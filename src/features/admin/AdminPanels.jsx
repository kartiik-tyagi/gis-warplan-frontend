import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Button,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { del, get, patch, post, put } from '../../shared/api/http'
import { EMPTY_LIST } from '../../shared/lib/empty'
import { logger } from '../../shared/lib/logger'
import { ConfirmDialog } from '../../shared/ui/ConfirmDialog'
import { LoadingState } from '../../shared/ui/LoadingState'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { useToastStore } from '../feedback/useToastStore'
import { ExerciseLayout } from '../scenario/ExerciseLayout'
import { asTheme, selectableThemes } from './themeChoices'

const cardSx = {
  p: 2,
  borderRadius: 2,
  border: 1,
  borderColor: 'divider',
  bgcolor: 'background.paper',
}

function ThemeField({ themes, value, onChange, holderKind, holderId, label = 'Theme', allowEmpty = false, emptyLabel = 'Inherit the team theme' }) {
  const options = selectableThemes(themes, holderKind, holderId)
  return (
    <SearchSelect
      label={label}
      required={!allowEmpty}
      clearLabel={allowEmpty ? emptyLabel : undefined}
      options={options}
      value={value}
      onChange={onChange}
      getOptionLabel={(theme) => theme.name}
      getOptionValue={(theme) => String(theme.id)}
    />
  )
}

function sameIds(left, right) {
  const a = [...(left || [])].map(Number).sort((x, y) => x - y)
  const b = [...(right || [])].map(Number).sort((x, y) => x - y)
  return a.length === b.length && a.every((id, index) => id === b[index])
}

function statusOf(user) {
  if (user.standardNodeId) return user.active ? 'On for the active game' : 'Off for this game'
  return user.active ? 'Active' : 'Inactive'
}

async function loadDirectory() {
  const [userRows, roleRows, sideRows, themeRows] = await Promise.all([get('/users'), get('/roles'), get('/sides'), get('/themes')])
  return {
    users: userRows || EMPTY_LIST,
    roles: roleRows || EMPTY_LIST,
    sides: (sideRows || EMPTY_LIST).filter((side) => side.kind !== 'alliance'),
    themes: (themeRows || EMPTY_LIST).map(asTheme),
  }
}

function UsersList() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [rows, setRows] = useState(null)
  const [roles, setRoles] = useState(EMPTY_LIST)
  const [sides, setSides] = useState(EMPTY_LIST)
  const [themes, setThemes] = useState(EMPTY_LIST)

  const load = useCallback(async () => {
    try {
      const directory = await loadDirectory()
      setRows(directory.users)
      setRoles(directory.roles)
      setSides(directory.sides)
      setThemes(directory.themes)
    } catch (error) {
      setRows(EMPTY_LIST)
      push(error?.message || 'Users could not be loaded.', 'error')
    }
  }, [push])

  useEffect(() => {
    load()
  }, [load])

  if (!rows) return <LoadingState label="Loading users" />

  const roleName = (id) => roles.find((role) => role.id === id)?.name
  const sideName = (id) => sides.find((side) => String(side.id) === String(id))?.name
  const themeName = (id) => themes.find((theme) => String(theme.id) === String(id))?.name

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Accounts can be created here, or from an ORBAT node with Mark as user. A user on a team inherits that team&apos;s theme until an override is allotted.
      </Typography>
      {!rows.length ? (
        <Box sx={{ py: 8, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>No users yet</Typography>
          <Typography variant="body2" sx={{ mb: 2.5, color: 'text.secondary' }}>Create the first account for this exercise.</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/access/users/new')}>New user</Button>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {rows.map((user) => {
            const home = sideName(user.homeSideId)
            const names = (user.roleIds || []).map(roleName).filter(Boolean)
            return (
              <Box key={user.id} sx={cardSx}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.75 }} flexWrap="wrap" useFlexGap>
                  <Typography variant="h6" sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: '1.05rem' }}>{user.name}</Typography>
                  <Chip size="small" label={statusOf(user)} color={user.active ? 'success' : 'default'} variant={user.active ? 'filled' : 'outlined'} />
                  {user.name === 'APEX' ? <Chip size="small" variant="outlined" label="Login theme" /> : null}
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                  {names.length ? names.join(', ') : 'No roles'}
                  {' · '}
                  {home ? `Team ${home}` : 'No team'}
                  {' · '}
                  {themeName(user.displayThemeId) || 'No theme'}
                  {user.standardNodeId ? ' · From an ORBAT node' : ''}
                </Typography>
                {user.name === 'APEX' ? null : (
                  <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/access/users/${user.id}`)}>
                    Edit
                  </Button>
                )}
              </Box>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}

function UserEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [ready, setReady] = useState(false)
  const [user, setUser] = useState(null)
  const [roles, setRoles] = useState(EMPTY_LIST)
  const [sides, setSides] = useState(EMPTY_LIST)
  const [themes, setThemes] = useState(EMPTY_LIST)
  const [name, setName] = useState('')
  const [password, setPassword] = useState('')
  const [roleIds, setRoleIds] = useState([])
  const [sideId, setSideId] = useState('')
  const [themeId, setThemeId] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    let live = true
    setReady(false)
    loadDirectory()
      .then((directory) => {
        if (!live) return
        setRoles(directory.roles)
        setSides(directory.sides)
        setThemes(directory.themes)
        if (isNew) {
          setReady(true)
          return
        }
        const found = directory.users.find((item) => String(item.id) === String(id))
        setUser(found || null)
        if (found) {
          setName(found.name)
          setRoleIds(found.roleIds || [])
          setSideId(found.administeredSideId == null ? '' : String(found.administeredSideId))
          setThemeId(found.themeId == null ? '' : String(found.themeId))
        }
        setReady(true)
      })
      .catch((error) => {
        if (!live) return
        push(error?.message || 'The user could not be opened.', 'error')
        setReady(true)
      })
    return () => {
      live = false
    }
  }, [id, isNew, push])

  const saveNew = async () => {
    if (!name.trim() || password.length < 3 || !roleIds.length) return
    if (!sideId && !themeId) {
      push('Choose a team, or allot a theme when the user has no team.', 'warning')
      return
    }
    setBusy(true)
    try {
      const created = await post('/users', {
        name: name.trim(),
        password,
        roleIds,
        administeredSideId: sideId ? Number(sideId) : null,
        themeId: themeId ? Number(themeId) : null,
      })
      logger.info('user.created', { name: name.trim() })
      push('User created.', 'success')
      navigate(`/access/users/${created.id}`, { replace: true })
    } catch (error) {
      push(error?.message || 'The user could not be created.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const saveExisting = async () => {
    if (!user) return
    const body = {}
    if (!sameIds(roleIds, user.roleIds)) body.roleIds = roleIds
    if (sideId && String(user.administeredSideId ?? '') !== sideId) body.administeredSideId = Number(sideId)
    if (themeId && String(user.themeId ?? '') !== themeId) body.themeId = Number(themeId)
    if (!themeId && user.themeId) body.clearTheme = true
    if (!Object.keys(body).length) {
      push('Nothing to save.', 'info')
      return
    }
    setBusy(true)
    try {
      await patch(`/users/${user.id}`, body)
      push('User saved.', 'success')
      navigate('/access/users')
    } catch (error) {
      push(error?.message || 'The user could not be updated.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const setPasswordOnly = async () => {
    if (!user || password.length < 3) return
    setBusy(true)
    try {
      await patch(`/users/${user.id}`, { password })
      setPassword('')
      push('Password set.', 'success')
    } catch (error) {
      push(error?.message || 'The password could not be set.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const toggleActive = async () => {
    if (!user) return
    setBusy(true)
    try {
      await patch(`/users/${user.id}`, { active: !user.active })
      push(user.active ? 'User deactivated.' : 'User activated.', 'success')
      navigate('/access/users')
    } catch (error) {
      push(error?.message || 'The user could not be updated.', 'error')
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <LoadingState label="Opening user" />
  if (!isNew && !user) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">This user is no longer available.</Typography>
        <Button onClick={() => navigate('/access/users')}>Back to list</Button>
      </Stack>
    )
  }

  const home = sides.find((side) => String(side.id) === String(user?.homeSideId))
  const apex = user?.name === 'APEX'

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 640 }}>
      {isNew ? (
        <>
          <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} fullWidth required />
          <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} helperText="At least 3 characters" fullWidth required />
          <SearchSelect multiple required label="Roles" options={roles} value={roleIds} onChange={setRoleIds} getOptionLabel={(role) => role.name} getOptionValue={(role) => role.id} />
          <SearchSelect label="Team" clearLabel="No team" options={sides} value={sideId} onChange={setSideId} getOptionLabel={(side) => side.name} getOptionValue={(side) => String(side.id)} />
          <ThemeField themes={themes} value={themeId} onChange={setThemeId} holderKind="USER" allowEmpty={Boolean(sideId)} />
        </>
      ) : apex ? (
        <Typography variant="body2" color="text.secondary">APEX keeps the login theme and changes it from the user menu.</Typography>
      ) : (
        <>
          <Typography variant="body2" color="text.secondary">
            {home ? `Team ${home.name}. ` : 'No team. '}
            {user.standardNodeId ? 'Created from an ORBAT node. Active state follows the game.' : statusOf(user) + '.'}
          </Typography>
          <SearchSelect multiple label="Roles" options={roles} value={roleIds} onChange={setRoleIds} getOptionLabel={(role) => role.name} getOptionValue={(role) => role.id} />
          <SearchSelect label="Administers team" options={sides} value={sideId} onChange={setSideId} getOptionLabel={(side) => side.name} getOptionValue={(side) => String(side.id)} />
          <ThemeField themes={themes} value={themeId} onChange={setThemeId} holderKind="USER" holderId={user.id} allowEmpty={Boolean(home)} label="Override theme" emptyLabel="Inherit the team theme" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
            <TextField type="password" label="New password" value={password} onChange={(event) => setPassword(event.target.value)} helperText="Leave blank to keep the current password" fullWidth />
            <Button variant="outlined" disabled={busy || password.length < 3} onClick={setPasswordOnly} sx={{ flexShrink: 0, alignSelf: { sm: 'flex-start' }, mt: { sm: 1 } }}>
              Set password
            </Button>
          </Stack>
        </>
      )}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button onClick={() => navigate('/access/users')} disabled={busy}>Back to list</Button>
        {apex ? null : (
          <Button
            variant="contained"
            startIcon={<SaveOutlinedIcon />}
            disabled={busy || (isNew && (!name.trim() || password.length < 3 || !roleIds.length))}
            onClick={isNew ? saveNew : saveExisting}
          >
            {busy ? 'Saving…' : isNew ? 'Create user' : 'Save user'}
          </Button>
        )}
        {!isNew && user && !apex && !user.standardNodeId ? (
          <Button color={user.active ? 'error' : 'primary'} variant="outlined" disabled={busy} onClick={toggleActive}>
            {user.active ? 'Deactivate' : 'Activate'}
          </Button>
        ) : null}
      </Stack>
    </Stack>
  )
}

function RolesList() {
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [roles, setRoles] = useState(null)
  const [catalog, setCatalog] = useState(EMPTY_LIST)

  const load = useCallback(async () => {
    try {
      const [roleRows, functionalityRows] = await Promise.all([get('/roles'), get('/functionalities')])
      setRoles(roleRows || EMPTY_LIST)
      setCatalog(functionalityRows || EMPTY_LIST)
    } catch (error) {
      setRoles(EMPTY_LIST)
      push(error?.message || 'Roles could not be loaded.', 'error')
    }
  }, [push])

  useEffect(() => {
    load()
  }, [load])

  if (!roles) return <LoadingState label="Loading roles" />

  const functionalityName = (id) => catalog.find((item) => item.id === id)?.name

  return (
    <Stack spacing={2}>
      <Typography variant="body2" color="text.secondary">
        Roles are defined here. ORBAT and user management only assign them.
      </Typography>
      {!roles.length ? (
        <Box sx={{ py: 8, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 1 }}>No roles yet</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/access/roles/new')} sx={{ mt: 1 }}>New role</Button>
        </Box>
      ) : (
        <Stack spacing={1.25}>
          {roles.map((role) => {
            const names = (role.functionalityIds || []).map(functionalityName).filter(Boolean)
            return (
              <Box key={role.id} sx={cardSx}>
                <Stack direction="row" spacing={1.5} alignItems="center" sx={{ mb: 0.75 }} flexWrap="wrap" useFlexGap>
                  <Typography variant="h6" sx={{ flex: 1, minWidth: 0, fontWeight: 600, fontSize: '1.05rem' }}>{role.name}</Typography>
                  <Chip size="small" variant="outlined" label={role.code} />
                  {role.standard ? <Chip size="small" color="primary" label="Built-in" /> : null}
                </Stack>
                <Typography variant="body2" sx={{ color: 'text.secondary', mb: 1.5 }}>
                  {names.length ? names.join(', ') : 'No functionalities'}
                </Typography>
                <Button size="small" variant="outlined" startIcon={<EditOutlinedIcon />} onClick={() => navigate(`/access/roles/${role.id}`)}>
                  Edit
                </Button>
              </Box>
            )
          })}
        </Stack>
      )}
    </Stack>
  )
}

function RoleEditor() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  const navigate = useNavigate()
  const push = useToastStore((state) => state.push)
  const [ready, setReady] = useState(false)
  const [role, setRole] = useState(null)
  const [catalog, setCatalog] = useState(EMPTY_LIST)
  const [code, setCode] = useState('')
  const [name, setName] = useState('')
  const [functionalityIds, setFunctionalityIds] = useState([])
  const [busy, setBusy] = useState(false)
  const [removing, setRemoving] = useState(false)

  useEffect(() => {
    let live = true
    setReady(false)
    Promise.all([get('/roles'), get('/functionalities')])
      .then(([roleRows, functionalityRows]) => {
        if (!live) return
        setCatalog(functionalityRows || EMPTY_LIST)
        if (isNew) {
          setReady(true)
          return
        }
        const found = (roleRows || EMPTY_LIST).find((item) => String(item.id) === String(id))
        setRole(found || null)
        if (found) {
          setCode(found.code || '')
          setName(found.name || '')
          setFunctionalityIds(found.functionalityIds || [])
        }
        setReady(true)
      })
      .catch((error) => {
        if (!live) return
        push(error?.message || 'The role could not be opened.', 'error')
        setReady(true)
      })
    return () => {
      live = false
    }
  }, [id, isNew, push])

  const create = async () => {
    if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(code.trim()) || !name.trim()) {
      push('Use a role code of letters, digits and underscores, starting with a letter.', 'warning')
      return
    }
    setBusy(true)
    try {
      const created = await post('/roles', { code: code.trim(), name: name.trim(), description: '', functionalityIds })
      push('Role created.', 'success')
      navigate(`/access/roles/${created.id}`, { replace: true })
    } catch (error) {
      push(error?.message || 'The role could not be created.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const save = async () => {
    if (!role || !name.trim()) return
    setBusy(true)
    try {
      await put(`/roles/${role.id}`, { code: role.code, name: name.trim(), description: role.description || '', functionalityIds })
      push('Role saved.', 'success')
      navigate('/access/roles')
    } catch (error) {
      push(error?.message || 'The role could not be saved.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const remove = async () => {
    if (!role) return
    setBusy(true)
    try {
      await del(`/roles/${role.id}`)
      push('Role removed.', 'success')
      navigate('/access/roles')
    } catch (error) {
      push(error?.message || 'The role could not be removed.', 'error')
      setRemoving(false)
    } finally {
      setBusy(false)
    }
  }

  if (!ready) return <LoadingState label="Opening role" />
  if (!isNew && !role) {
    return (
      <Stack spacing={2}>
        <Typography variant="body2" color="text.secondary">This role is no longer available.</Typography>
        <Button onClick={() => navigate('/access/roles')}>Back to list</Button>
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
      <TextField label="Role code" value={code} onChange={(event) => setCode(event.target.value)} helperText={isNew ? 'Letters, digits, and underscores. It cannot be changed later.' : 'The code cannot be changed.'} disabled={!isNew} fullWidth required />
      <TextField label="Role name" value={name} onChange={(event) => setName(event.target.value)} fullWidth required />
      <SearchSelect
        multiple
        label="Features"
        options={catalog}
        value={functionalityIds}
        onChange={setFunctionalityIds}
        getOptionLabel={(item) => item.name}
        getOptionValue={(item) => item.id}
        helperText="Choose what this role is allowed to do. Only these features can be selected."
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <Button onClick={() => navigate('/access/roles')} disabled={busy}>Back to list</Button>
        <Button variant="contained" startIcon={<SaveOutlinedIcon />} disabled={busy || !name.trim() || (isNew && !code.trim())} onClick={isNew ? create : save}>
          {busy ? 'Saving…' : isNew ? 'Create role' : 'Save role'}
        </Button>
        {!isNew && role && !role.standard ? (
          <Button color="error" variant="outlined" startIcon={<DeleteOutlinedIcon />} disabled={busy} onClick={() => setRemoving(true)}>
            Remove
          </Button>
        ) : null}
      </Stack>
      <ConfirmDialog
        open={removing}
        title="Remove role"
        message="Remove this role? Accounts that still hold it keep the assignment until someone edits them."
        confirmLabel="Remove"
        busy={busy}
        onClose={() => {
          if (!busy) setRemoving(false)
        }}
        onConfirm={remove}
      />
    </Stack>
  )
}

export function UsersListPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout
      kicker="Access"
      title="Users"
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/access/users/new')}>
          New user
        </Button>
      }
    >
      <UsersList />
    </ExerciseLayout>
  )
}

export function UserEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  return (
    <ExerciseLayout kicker="Access" title={isNew ? 'New user' : 'Edit user'}>
      <UserEditor />
    </ExerciseLayout>
  )
}

export function RolesListPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout
      kicker="Access"
      title="Roles"
      actions={
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => navigate('/access/roles/new')}>
          New role
        </Button>
      }
    >
      <RolesList />
    </ExerciseLayout>
  )
}

export function RoleEditorPage() {
  const { id } = useParams()
  const isNew = !id || id === 'new'
  return (
    <ExerciseLayout kicker="Access" title={isNew ? 'New role' : 'Edit role'}>
      <RoleEditor />
    </ExerciseLayout>
  )
}
