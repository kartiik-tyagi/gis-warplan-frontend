import { useEffect, useId, useRef } from 'react'
import { IconButton, InputAdornment } from '@mui/material'
import LocationOnOutlinedIcon from '@mui/icons-material/LocationOnOutlined'
import { useLocationPick } from './useLocationPick'

/** One pick shared by every location icon in a form. A click on any of them fills the same coordinates. */
export function useSharedMapPick(onPick) {
  const owner = useId()
  const onPickRef = useRef(onPick)
  onPickRef.current = onPick
  const token = useLocationPick((state) => state.token)
  const point = useLocationPick((state) => state.point)

  useEffect(() => {
    if (!point || point.owner !== owner) return
    onPickRef.current(point)
  }, [token, owner, point])

  useEffect(() => () => {
    const state = useLocationPick.getState()
    if (state.owner === owner) state.disarm()
  }, [owner])

  return owner
}

export function LocationPickIcon({ owner, disabled = false }) {
  const armed = useLocationPick((state) => state.armed && state.owner === owner)
  return (
    <IconButton
      type="button"
      aria-label="Choose on the map"
      size="small"
      edge="start"
      disabled={disabled}
      color={armed ? 'primary' : 'default'}
      onMouseDown={(event) => event.preventDefault()}
      onClick={() => useLocationPick.getState().arm(owner)}
    >
      <LocationOnOutlinedIcon fontSize="small" />
    </IconButton>
  )
}

export function locationStartAdornment(owner) {
  return (
    <InputAdornment position="start">
      <LocationPickIcon owner={owner} />
    </InputAdornment>
  )
}
