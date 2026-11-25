import { useCallback, useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import {
  Box,
  Chip,
  Stack,
  TextField,
  Typography,
} from '@mui/material'
import ArrowBackIcon from '@mui/icons-material/ArrowBack'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import EditOutlinedIcon from '@mui/icons-material/EditOutlined'
import PauseCircleOutlinedIcon from '@mui/icons-material/PauseCircleOutlined'
import PlayArrowOutlinedIcon from '@mui/icons-material/PlayArrowOutlined'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import VpnKeyOutlinedIcon from '@mui/icons-material/VpnKeyOutlined'
import { CreateAction } from '../../shared/ui/CreateAction'
import { EntityCard } from '../../shared/ui/EntityCard'
import { IconAction } from '../../shared/ui/IconAction'
import { titleCase } from '../../shared/lib/titleCase'
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

function ThemeField({ themes, value, onChange, holderKind, holderId, label = 'Theme', allowEmpty = false, emptyLabel = 'Inherit the side theme' }) {
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
    <Stack spacing={1.25}>
      {!rows.length ? (
        <Box sx={{ py: 6, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{titleCase('No Users Yet')}</Typography>
          <CreateAction label="New User" onClick={() => navigate('/access/users/new')} />
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {rows.map((user) => {
            const home = sideName(user.homeSideId)
            const names = (user.roleIds || []).map(roleName).filter(Boolean)
            return (
              <EntityCard
                key={user.id}
                title={user.name}
                chip={
                  <Stack direction="row" spacing={0.5}>
                    <Chip size="small" label={titleCase(statusOf(user))} color={user.active ? 'success' : 'default'} variant={user.active ? 'filled' : 'outlined'} />
                    {user.name === 'APEX' ? <Chip size="small" variant="outlined" label="Login Theme" /> : null}
                  </Stack>
                }
                meta={[
                  names.length ? names.join(', ') : 'No Roles',
                  home ? `Side ${home}` : 'No Side',
                  themeName(user.displayThemeId) || 'No Theme',
                ].join(' · ')}
                actions={
                  user.name === 'APEX' ? null : (
                    <IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/access/users/${user.id}`)} />
                  )
                }
              />
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
      push('Choose a side, or allot a theme when the user has no side.', 'warning')
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
      navigate('/access/users', { replace: true })
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
    if (!user.standardNodeId && sideId && String(user.administeredSideId ?? '') !== sideId) body.administeredSideId = Number(sideId)
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
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/access/users')} />
      </Stack>
    )
  }

  const home = sides.find((side) => String(side.id) === String(user?.homeSideId))
  const apex = user?.name === 'APEX'

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 640 }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/access/users')} disabled={busy} />
      </Box>
      {isNew ? (
        <>
          <TextField label="Name" value={name} onChange={(event) => setName(event.target.value)} fullWidth required />
          <TextField label="Password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} helperText="At least 3 characters" fullWidth required />
          <SearchSelect multiple required label="Roles" options={roles} value={roleIds} onChange={setRoleIds} getOptionLabel={(role) => role.name} getOptionValue={(role) => role.id} />
          <SearchSelect label="Side" clearLabel="No Side" options={sides} value={sideId} onChange={setSideId} getOptionLabel={(side) => side.name} getOptionValue={(side) => String(side.id)} />
          <ThemeField themes={themes} value={themeId} onChange={setThemeId} holderKind="USER" allowEmpty={Boolean(sideId)} />
        </>
      ) : apex ? null : (
        <>
          <SearchSelect multiple label="Roles" options={roles} value={roleIds} onChange={setRoleIds} getOptionLabel={(role) => role.name} getOptionValue={(role) => role.id} />
          {user.standardNodeId ? (
            <TextField
              label="Administers Side"
              value={home?.name || 'The side of this ORBAT node'}
              fullWidth
              slotProps={{ input: { readOnly: true } }}
            />
          ) : (
            <SearchSelect label="Administers Side" options={sides} value={sideId} onChange={setSideId} getOptionLabel={(side) => side.name} getOptionValue={(side) => String(side.id)} />
          )}
          <ThemeField themes={themes} value={themeId} onChange={setThemeId} holderKind="USER" holderId={user.id} allowEmpty={Boolean(home)} label="Override Theme" emptyLabel="Inherit the side theme" />
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} alignItems={{ sm: 'flex-start' }}>
            <TextField type="password" label="New Password" value={password} onChange={(event) => setPassword(event.target.value)} fullWidth />
            <IconAction
              label="Set Password"
              icon={<VpnKeyOutlinedIcon fontSize="small" />}
              disabled={busy || password.length < 3}
              onClick={setPasswordOnly}
            />
          </Stack>
        </>
      )}
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        {apex ? null : (
          <IconAction
            label={busy ? 'Saving…' : isNew ? 'Create User' : 'Save User'}
            icon={<SaveOutlinedIcon fontSize="small" />}
            disabled={busy || (isNew && (!name.trim() || password.length < 3 || !roleIds.length))}
            onClick={isNew ? saveNew : saveExisting}
            variant="contained"
          />
        )}
        {!isNew && user && !apex && !user.standardNodeId ? (
          <IconAction
            label={user.active ? 'Deactivate' : 'Activate'}
            icon={user.active ? <PauseCircleOutlinedIcon fontSize="small" /> : <PlayArrowOutlinedIcon fontSize="small" />}
            color={user.active ? 'error' : 'default'}
            disabled={busy}
            onClick={toggleActive}
          />
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
    <Stack spacing={1.25}>
      {!roles.length ? (
        <Box sx={{ py: 6, px: 3, textAlign: 'center', border: 1, borderColor: 'divider', borderStyle: 'dashed', borderRadius: 2 }}>
          <Typography variant="h6" sx={{ mb: 2 }}>{titleCase('No Roles Yet')}</Typography>
          <Box sx={{ display: 'flex', justifyContent: 'center' }}>
            <CreateAction label="New Role" onClick={() => navigate('/access/roles/new')} />
          </Box>
        </Box>
      ) : (
        <Stack spacing={0.75}>
          {roles.map((role) => {
            const names = (role.functionalityIds || []).map(functionalityName).filter(Boolean)
            return (
              <EntityCard
                key={role.id}
                title={role.name}
                meta={names.length ? names.join(', ') : 'No Functionalities'}
                actions={<IconAction label="Edit" icon={<EditOutlinedIcon fontSize="small" />} onClick={() => navigate(`/access/roles/${role.id}`)} />}
              />
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
    if (!name.trim()) {
      push('Enter a role name.', 'warning')
      return
    }
    setBusy(true)
    try {
      const created = await post('/roles', { name: name.trim(), description: '', functionalityIds })
      push('Role created.', 'success')
      navigate('/access/roles', { replace: true })
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
      await put(`/roles/${role.id}`, { name: name.trim(), description: role.description || '', functionalityIds })
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
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/access/roles')} />
      </Stack>
    )
  }

  return (
    <Stack spacing={2.5} sx={{ maxWidth: 720 }}>
      <Box sx={{ position: 'sticky', top: 0, zIndex: 2, py: 0.5, bgcolor: 'background.paper' }}>
        <IconAction label="Back" icon={<ArrowBackIcon fontSize="small" />} onClick={() => navigate('/access/roles')} disabled={busy} />
      </Box>
      <TextField label="Role Name" value={name} onChange={(event) => setName(event.target.value)} fullWidth required />
      <SearchSelect
        multiple
        label="Features"
        options={catalog}
        value={functionalityIds}
        onChange={setFunctionalityIds}
        getOptionLabel={(item) => item.name}
        getOptionValue={(item) => item.id}
      />
      <Stack direction="row" spacing={1} useFlexGap flexWrap="wrap">
        <IconAction
          label={busy ? 'Saving…' : isNew ? 'Create Role' : 'Save Role'}
          icon={<SaveOutlinedIcon fontSize="small" />}
          disabled={busy || !name.trim()}
          onClick={isNew ? create : save}
          variant="contained"
        />
        {!isNew && role && !role.standard ? (
          <IconAction label="Remove" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={busy} onClick={() => setRemoving(true)} />
        ) : null}
      </Stack>
      <ConfirmDialog
        open={removing}
        title="Remove Role"
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
    <ExerciseLayout actions={<CreateAction label="New User" onClick={() => navigate('/access/users/new')} />}>
      <UsersList />
    </ExerciseLayout>
  )
}

export function UserEditorPage() {
  return (
    <ExerciseLayout>
      <UserEditor />
    </ExerciseLayout>
  )
}

export function RolesListPage() {
  const navigate = useNavigate()
  return (
    <ExerciseLayout actions={<CreateAction label="New Role" onClick={() => navigate('/access/roles/new')} />}>
      <RolesList />
    </ExerciseLayout>
  )
}

export function RoleEditorPage() {
  return (
    <ExerciseLayout>
      <RoleEditor />
    </ExerciseLayout>
  )
}
