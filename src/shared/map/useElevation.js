import { useEffect, useRef, useState } from 'react'

/**
 * Debounced elevation / bathymetry for the map pointer (GEBCO via OpenTopoData).
 * Positive → land height; zero/negative → ocean depth (absolute).
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
        const url = `https://api.opentopodata.org/v1/gebco2020?locations=${encodeURIComponent(latitude)},${encodeURIComponent(longitude)}`
        const response = await fetch(url)
        if (!response.ok) throw new Error('elevation unavailable')
        const body = await response.json()
        const value = Number(body?.results?.[0]?.elevation)
        if (id !== requestId.current) return
        if (!Number.isFinite(value)) {
          setElevation(null)
          setKind(null)
          return
        }
        if (value > 0) {
          setKind('height')
          setElevation(value)
        } else {
          setKind('depth')
          setElevation(Math.abs(value))
        }
      } catch {
        if (id !== requestId.current) return
        setElevation(null)
        setKind(null)
      }
    }, 500)

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
