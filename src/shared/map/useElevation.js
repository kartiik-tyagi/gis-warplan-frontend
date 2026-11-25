import { useEffect, useRef, useState } from 'react'
import { get } from '../api/http'

/**
 * Land height or ocean depth at the pointer, from the elevation layer chosen in map settings.
 * No layer chosen, or no reading from that layer, leaves the value empty.
 */
export function useElevation(latitude, longitude) {
  const [elevation, setElevation] = useState(null)
  const [kind, setKind] = useState(null)
  const requestId = useRef(0)

  useEffect(() => {
    if (latitude == null || longitude == null || Number.isNaN(Number(latitude)) || Number.isNaN(Number(longitude))) {
      setElevation(null)
      setKind(null)
      return undefined
    }

    const id = ++requestId.current
    const timer = window.setTimeout(async () => {
      try {
        const body = await get('/map/elevation', { latitude, longitude })
        if (id !== requestId.current) return
        const value = Number(body?.meters)
        if (!Number.isFinite(value) || (body?.kind !== 'height' && body?.kind !== 'depth')) {
          setElevation(null)
          setKind(null)
          return
        }
        setKind(body.kind)
        setElevation(value)
      } catch {
        if (id !== requestId.current) return
        setElevation(null)
        setKind(null)
      }
    }, 400)

    return () => window.clearTimeout(timer)
  }, [latitude, longitude])

  return { elevation, kind }
}

export function formatElevationMeters(value) {
  if (value == null || !Number.isFinite(Number(value))) return '—'
  const number = Number(value)
  if (Math.abs(number) >= 100) return `${Math.round(number)} m`
  if (Math.abs(number) >= 10) return `${number.toFixed(1)} m`
  return `${number.toFixed(2)} m`
}
