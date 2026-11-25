import { useEffect, useRef, useState } from 'react'
import { Avatar, Box, Dialog, DialogActions, DialogContent, DialogTitle, Divider, IconButton, Menu, MenuItem, TextField, Typography } from '@mui/material'
import CheckOutlinedIcon from '@mui/icons-material/CheckOutlined'
import CloseIcon from '@mui/icons-material/Close'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { useCommit } from '../../features/directory/useDirectoryStore'
import { useToastStore } from '../../features/feedback/useToastStore'
import { useSessionStore } from '../../features/session/useSessionStore'
import * as api from '../../shared/api/client'
import { get } from '../api/http'
import { themeFromEntity } from '../api/mappers'
import { EMPTY_LIST } from '../lib/empty'
import { IconAction } from './IconAction'
import { SearchSelect } from './SearchSelect'

export function UserMenu({ open = false, onOpenChange, buttonRef }) {
  const profile = useSessionStore((state) => state.session?.profile)
  const theme = useSessionStore((state) => state.session?.theme)
  const canSelectTheme = useSessionStore((state) => state.session?.canSelectTheme)
  const chooseTheme = useSessionStore((state) => state.chooseTheme)
  const signOut = useSessionStore((state) => state.signOut)
  const commit = useCommit()
  const push = useToastStore((state) => state.push)
  const [passwordOpen, setPasswordOpen] = useState(false)
  const [themeOpen, setThemeOpen] = useState(false)
  const [themeChoices, setThemeChoices] = useState(EMPTY_LIST)
  const [themeId, setThemeId] = useState('')
  const [themeBusy, setThemeBusy] = useState(false)
  const [currentPassword, setCurrentPassword] = useState('')
  const [nextPassword, setNextPassword] = useState('')
  const localRef = useRef(null)
  const ref = buttonRef || localRef
  const [anchor, setAnchor] = useState(null)

  useEffect(() => {
    if (open) setAnchor(ref.current)
  }, [open, ref])

  const close = () => {
    setAnchor(null)
    onOpenChange?.(false)
  }

  const openTheme = () => {
    close()
    setThemeId(theme?.id || '')
    setThemeOpen(true)
    get('/themes')
      .then((rows) => {
        const available = rows.map(themeFromEntity).filter((item) => item.holderKind === 'FREE' || item.loginTheme || item.id === String(theme?.id))
        setThemeChoices(available)
        setThemeId((current) => current || available[0]?.id || '')
      })
      .catch((error) => push(error?.message || 'The themes could not be loaded.', 'error'))
  }

  const applyTheme = () => {
    if (!themeId || themeId === theme?.id) {
      setThemeOpen(false)
      return
    }
    setThemeBusy(true)
    chooseTheme(themeId)
      .then(() => setThemeOpen(false))
      .catch((error) => push(error?.message || 'The theme could not be changed.', 'error'))
      .finally(() => setThemeBusy(false))
  }

  if (!profile) return null

  return (
    <>
      <IconButton ref={ref} aria-label={`${profile.title} profile`} onClick={(event) => setAnchor(event.currentTarget)}>
        <Avatar src={profile.avatarUrl} alt="" variant="rounded" sx={{ width: 36, height: 36 }} />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={close} slotProps={{ paper: { sx: { maxHeight: 480 } } }}>
        <Box sx={{ px: 2, py: 1, width: 280 }}>
          <Typography variant="subtitle1">{profile.title}</Typography>
          <Typography variant="body2" color="text.secondary">
            {profile.role}
          </Typography>
          <Typography variant="caption" color="text.secondary">
            {profile.service}
          </Typography>
        </Box>
        <Divider />
        {canSelectTheme ? (
          <MenuItem onClick={openTheme} sx={{ minHeight: 44 }}>
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="body2">Theme</Typography>
              <Typography variant="caption" color="text.secondary">{theme?.name || 'Choose'}</Typography>
            </Box>
          </MenuItem>
        ) : (
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2">Theme</Typography>
            <Typography variant="caption" color="text.secondary">{theme?.name}</Typography>
          </Box>
        )}
        <Divider />
        <MenuItem
          onClick={() => {
            close()
            setPasswordOpen(true)
          }}
          sx={{ minHeight: 44 }}
        >
          Change password
        </MenuItem>
        <MenuItem
          onClick={() => {
            close()
            signOut()
          }}
          sx={{ minHeight: 44 }}
        >
          Sign out
        </MenuItem>
      </Menu>
      <Dialog open={themeOpen} onClose={themeBusy ? undefined : () => setThemeOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Theme</DialogTitle>
        <DialogContent>
          <SearchSelect
            label="Theme"
            options={themeChoices}
            value={themeChoices.some((item) => item.id === themeId) ? themeId : ''}
            onChange={setThemeId}
            getOptionLabel={(item) => item.name}
            getOptionValue={(item) => item.id}
          />
        </DialogContent>
        <DialogActions>
          <IconAction label="Cancel" icon={<CloseIcon fontSize="small" />} onClick={() => setThemeOpen(false)} disabled={themeBusy} />
          <IconAction
            label={themeBusy ? 'Saving' : 'Use Theme'}
            icon={<CheckOutlinedIcon fontSize="small" />}
            onClick={applyTheme}
            disabled={themeBusy || !themeId}
            variant="contained"
          />
        </DialogActions>
      </Dialog>
      <Dialog open={passwordOpen} onClose={() => setPasswordOpen(false)} fullWidth maxWidth="xs">
        <DialogTitle>Change Password</DialogTitle>
        <DialogContent>
          <TextField fullWidth margin="dense" type="password" label="Current Password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} />
          <TextField fullWidth margin="dense" type="password" label="New Password" value={nextPassword} onChange={(event) => setNextPassword(event.target.value)} />
        </DialogContent>
        <DialogActions>
          <IconAction label="Cancel" icon={<CloseIcon fontSize="small" />} onClick={() => setPasswordOpen(false)} />
          <IconAction
            label="Change"
            icon={<SaveOutlinedIcon fontSize="small" />}
            variant="contained"
            onClick={() =>
              commit((userId) => api.updatePassword(userId, currentPassword, nextPassword))
                .then(() => {
                  setPasswordOpen(false)
                  setCurrentPassword('')
                  setNextPassword('')
                })
                .catch(() => {})
            }
          />
        </DialogActions>
      </Dialog>
    </>
  )
}
