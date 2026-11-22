import { useEffect, useState } from 'react'
import { Button, Dialog, DialogActions, DialogContent, DialogTitle, TextField } from '@mui/material'
import { SearchSelect } from './SearchSelect'
import * as api from '../../shared/api/client'
import { EMPTY_LIST } from '../lib/empty'
import { useCommit, useDirectoryStore } from '../../features/directory/useDirectoryStore'

export function DraftDialog() {
  const pending = useDirectoryStore((state) => state.pending)
  const setPending = useDirectoryStore((state) => state.setPending)
  const sides = useDirectoryStore((state) => state.data?.sides ?? EMPTY_LIST)
  const commit = useCommit()
  const [name, setName] = useState('')
  const [sideId, setSideId] = useState('')

  useEffect(() => {
    if (pending) {
      setName('')
      setSideId('')
    }
  }, [pending])

  const save = () => {
    const work =
      pending?.surface === 'planning'
        ? (userId) =>
            api.createGraphic(userId, {
              name,
              sideId,
              shapeType: pending.shapeType,
              geometry: pending.geometry,
              stampId: pending.stampId,
              symbolId: pending.symbolId,
            })
        : (userId) =>
            api.createFeature(userId, {
              name,
              sideId,
              featureType: pending.featureType,
              geometry: pending.geometry,
              curved: pending.curved,
            })
    commit(work)
      .then(() => setPending(null))
      .catch(() => {})
  }

  return (
    <Dialog open={Boolean(pending)} onClose={() => setPending(null)} fullWidth maxWidth="xs">
      <DialogTitle>{pending?.surface === 'planning' ? 'Keep this graphic' : 'Keep this feature'}</DialogTitle>
      <DialogContent>
        <TextField fullWidth margin="dense" label="Name" value={name} onChange={(event) => setName(event.target.value)} />
        <SearchSelect
          label="Side"
          clearLabel="None"
          options={sides}
          value={sideId}
          onChange={setSideId}
          getOptionLabel={(side) => side.name}
          getOptionValue={(side) => side.id}
        />
      </DialogContent>
      <DialogActions>
        <Button onClick={() => setPending(null)}>Cancel</Button>
        <Button variant="contained" onClick={save}>
          Keep
        </Button>
      </DialogActions>
    </Dialog>
  )
}
