import { useEffect, useRef, useState } from 'react'
import { Box, Typography } from '@mui/material'
import { MapWorkbench } from '../../components/MapWorkbench'
import SituationMap from '../../components/SituationMap'
import { OrbatLayer } from '../../components/OrbatLayer'
import { SituationLayer } from '../../components/SituationLayer.jsx'
import { useDirectoryStore } from '../../features/directory/useDirectoryStore'
import { useSituation } from '../../features/situation/useSituation'
import { useSessionStore } from '../../features/session/useSessionStore'
import { get } from '../api/http'
import { useLocationPick } from '../map/useLocationPick'

function formatCoordinate(value) {
  return Number(value).toFixed(4)
}

export function pictureLayers(session, directory) {
  if (!session) return []
  return session.filters.map((filter) => ({
    ...filter,
    opacity: directory?.opacity?.[filter.id] ?? 1,
    visible: filter.visible,
  }))
}

export function pictureService(session, directory) {
  if (!session) return ''
  return directory?.settings?.geoserverUrl || session.mapService || ''
}

export function MapStage({ readout = 'bar', onReadout }) {
  const session = useSessionStore((state) => state.session)
  const resetToken = useSessionStore((state) => state.resetToken)
  const directory = useDirectoryStore((state) => state.data)
  const measure = useDirectoryStore((state) => state.measure)
  const [pointer, setPointer] = useState(null)
  const [zoom, setZoom] = useState(session?.mapView?.zoom ?? null)
  const [resolution, setResolution] = useState(null)
  const [map, setMap] = useState(null)
  const onReadoutRef = useRef(onReadout)
  onReadoutRef.current = onReadout
  const situationRevision = useSituation((state) => state.revision)
  const userId = session?.me?.userId
  const playingOrbatId = session?.me?.playingOrbatId
  const canWork = session?.me?.canWork
  const picking = useLocationPick((state) => state.armed)

  useEffect(() => {
    const element = map?.getTargetElement?.()
    if (!element) return undefined
    const previous = element.style.cursor
    if (picking) element.style.cursor = 'crosshair'
    const frame = requestAnimationFrame(() => map.updateSize())
    return () => {
      cancelAnimationFrame(frame)
      element.style.cursor = previous
    }
  }, [map, picking])

  useEffect(() => {
    if (!picking) return undefined
    const onKey = (event) => {
      if (event.key === 'Escape') useLocationPick.getState().disarm()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [picking])

  useEffect(() => {
    if (!session) return undefined
    let live = true
    let last = 0
    const pull = (force) => {
      const now = Date.now()
      if (!force && now - last < 1500) return
      last = now
      get('/situation')
        .then((picture) => { if (live) useSituation.getState().setPicture(picture) })
        .catch(() => { if (live) useSituation.getState().setPicture(null) })
    }
    pull(true)
    const onVisible = () => {
      if (document.visibilityState === 'hidden') return
      pull(false)
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', onVisible)
    return () => {
      live = false
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', onVisible)
    }
  }, [session, userId, playingOrbatId, canWork, situationRevision])

  useEffect(() => {
    onReadoutRef.current?.({
      latitude: pointer?.latitude ?? null,
      longitude: pointer?.longitude ?? null,
      zoom,
      resolution,
      height: null,
    })
  }, [pointer, zoom, resolution])
  if (!session) return null
  const layers = pictureLayers(session, directory)

  const coordinates = pointer
    ? `${formatCoordinate(pointer.latitude)}° N, ${formatCoordinate(pointer.longitude)}° E`
    : 'Move the pointer over the map'

  const readoutBar = (
    <Box
      sx={{
        height: 32,
        px: 1.5,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 2,
        borderTop: 1,
        borderColor: 'divider',
        bgcolor: 'background.paper',
      }}
    >
      <Typography variant="caption" noWrap>
        {coordinates}
      </Typography>
      <Typography variant="caption" noWrap>
        EPSG:3857 · zoom {zoom ?? '—'}
      </Typography>
    </Box>
  )

  return (
    <Box sx={{ flex: 1, minWidth: 0, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
      <Box sx={{ flex: 1, minHeight: 0, position: 'relative' }}>
        <SituationLayer map={map} />
        <OrbatLayer map={map} />
        <SituationMap
          view={session.mapView}
          serviceUrl={pictureService(session, directory)}
          layers={layers}
          resetToken={resetToken}
          onPointer={setPointer}
          onZoom={setZoom}
          onView={(next) => {
            setZoom(next.zoom)
            setResolution(next.resolution)
          }}
          onMap={setMap}
        />
        <MapWorkbench map={map} />
        {measure ? (
          <Box sx={{ position: 'absolute', top: 12, left: 12, zIndex: 2, px: 1, py: 0.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider' }}>
            <Typography variant="caption">{measure}</Typography>
          </Box>
        ) : null}
        {picking ? (
          <Box
            sx={(theme) => ({
              position: 'absolute',
              top: 12,
              left: '50%',
              transform: 'translateX(-50%)',
              zIndex: theme.zIndex.modal + 1,
              px: 1.25,
              py: 0.75,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'primary.main',
              borderRadius: 1,
              display: 'flex',
              alignItems: 'center',
              gap: 1,
              pointerEvents: 'auto',
            })}
          >
            <Typography
              component="button"
              variant="caption"
              onClick={() => useLocationPick.getState().disarm()}
              sx={{ border: 0, bgcolor: 'transparent', color: 'primary.main', cursor: 'pointer', font: 'inherit' }}
            >
              Back to form
            </Typography>
          </Box>
        ) : null}
        {readout === 'overlay' ? (
          <Box
            sx={{
              position: 'absolute',
              left: 12,
              bottom: 36,
              zIndex: 2,
              px: 1,
              py: 0.5,
              bgcolor: 'background.paper',
              border: 1,
              borderColor: 'divider',
              maxWidth: 'calc(100% - 72px)',
            }}
          >
            <Typography variant="caption" noWrap>
              {coordinates} · zoom {zoom ?? '—'}
            </Typography>
          </Box>
        ) : null}
      </Box>
      {readout === 'bar' ? readoutBar : null}
    </Box>
  )
}
