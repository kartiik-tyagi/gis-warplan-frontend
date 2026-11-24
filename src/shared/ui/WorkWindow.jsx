import { useEffect } from 'react'
import { useLocation, useNavigate, useOutlet } from 'react-router-dom'
import { Box, IconButton } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import DragIndicatorIcon from '@mui/icons-material/DragIndicator'
import { create } from 'zustand'
import { sectionFromPath } from '../auth/access'
import { useLocationPick } from '../map/useLocationPick'
import { SectionSwitcher } from './SectionSwitcher'

/** Hard floor for resize — forms cannot shrink below this. */
const MIN_W = 420
const MIN_H = 320
const MARGIN = 8
const MENU_CLEARANCE = 56

function viewportLimits() {
  const maxW = Math.max(280, window.innerWidth - MARGIN * 2)
  const maxH = Math.max(220, window.innerHeight - MARGIN * 2)
  return {
    minW: Math.min(MIN_W, maxW),
    minH: Math.min(MIN_H, maxH),
    maxW,
    maxH,
  }
}

function clampWorkBox(box) {
  const { minW, minH, maxW, maxH } = viewportLimits()
  const width = Math.min(maxW, Math.max(minW, box.width))
  const height = Math.min(maxH, Math.max(minH, box.height))
  const x = Math.min(Math.max(MARGIN, box.x), window.innerWidth - width - MARGIN)
  const y = Math.min(Math.max(MARGIN, box.y), window.innerHeight - height - MARGIN)
  return { x, y, width, height }
}

function defaultWorkBox() {
  const vw = window.innerWidth
  const vh = window.innerHeight
  const width = Math.round(vw * 0.62)
  const height = Math.min(Math.round(vh * 0.68), vh - MENU_CLEARANCE - MARGIN)
  const x = Math.round((vw - width) / 2)
  const y = Math.max(MENU_CLEARANCE, Math.round((vh - height) / 2))
  return clampWorkBox({ x, y, width, height })
}

const useWorkWindowStore = create((set) => ({
  box: null,
  place: (box) => set({ box: clampWorkBox(box) }),
  ensure: () => set((state) => ({ box: state.box ? clampWorkBox(state.box) : defaultWorkBox() })),
  resetDefault: () => set({ box: defaultWorkBox() }),
}))

function startGesture(event, mode, box, place) {
  if (event.button !== 0) return
  event.preventDefault()
  event.stopPropagation()
  const startX = event.clientX
  const startY = event.clientY
  const origin = box
  const previousUserSelect = document.body.style.userSelect
  document.body.style.userSelect = 'none'

  const move = (ev) => {
    const dx = ev.clientX - startX
    const dy = ev.clientY - startY
    if (mode === 'move') {
      place({ ...origin, x: origin.x + dx, y: origin.y + dy })
      return
    }
    place({
      x: origin.x,
      y: origin.y,
      width: mode === 's' ? origin.width : origin.width + dx,
      height: mode === 'e' ? origin.height : origin.height + dy,
    })
  }
  const end = () => {
    document.body.style.userSelect = previousUserSelect
    window.removeEventListener('pointermove', move)
    window.removeEventListener('pointerup', end)
    window.removeEventListener('pointercancel', end)
  }
  window.addEventListener('pointermove', move)
  window.addEventListener('pointerup', end)
  window.addEventListener('pointercancel', end)
}

function ResizeHandle({ mode, label, box, place, sx }) {
  return (
    <Box
      aria-label={label}
      onPointerDown={(event) => startGesture(event, mode, box, place)}
      sx={{
        position: 'absolute',
        touchAction: 'none',
        zIndex: 1,
        ...sx,
      }}
    />
  )
}

/**
 * Non-modal window over the map. Outside clicks, the map, and Escape leave it open.
 * It closes only from the close button.
 */
export function WorkWindow() {
  const outlet = useOutlet()
  const location = useLocation()
  const navigate = useNavigate()
  const section = sectionFromPath(location.pathname)
  const box = useWorkWindowStore((state) => state.box)
  const place = useWorkWindowStore((state) => state.place)
  const ensure = useWorkWindowStore((state) => state.ensure)
  const picking = useLocationPick((state) => state.armed)

  useEffect(() => {
    if (sectionFromPath(location.pathname)) ensure()
  }, [location.pathname, ensure])

  useEffect(() => {
    if (!sectionFromPath(location.pathname)) return undefined
    const onResize = () => useWorkWindowStore.getState().ensure()
    window.addEventListener('resize', onResize)
    return () => window.removeEventListener('resize', onResize)
  }, [location.pathname])

  if (!section) return outlet
  const frame = box ?? defaultWorkBox()
  const { minW, minH } = viewportLimits()

  return (
    <Box
      role="dialog"
      aria-modal="false"
      aria-labelledby="work-window-title"
      sx={(theme) => ({
        position: 'fixed',
        left: frame.x,
        top: frame.y,
        width: frame.width,
        height: frame.height,
        zIndex: theme.zIndex.modal - 100,
        display: 'flex',
        flexDirection: 'column',
        bgcolor: 'background.paper',
        color: 'text.primary',
        border: 1,
        borderColor: 'divider',
        borderRadius: 1,
        boxShadow: 8,
        overflow: 'hidden',
        minWidth: minW,
        minHeight: minH,
        visibility: picking ? 'hidden' : 'visible',
        pointerEvents: picking ? 'none' : 'auto',
      })}
    >
      <Box
        onPointerDown={(event) => {
          if (event.target.closest('button, [role="button"], a')) return
          startGesture(event, 'move', frame, place)
        }}
        sx={{
          minHeight: 44,
          px: 1,
          display: 'flex',
          alignItems: 'center',
          gap: 0.5,
          flexShrink: 0,
          borderBottom: 1,
          borderColor: 'divider',
          bgcolor: 'background.paper',
          cursor: 'grab',
          touchAction: 'none',
          userSelect: 'none',
          '&:active': { cursor: 'grabbing' },
        }}
      >
        <DragIndicatorIcon fontSize="small" sx={{ color: 'text.secondary' }} />
        <SectionSwitcher currentId={section.id} title={section.title} />
        <IconButton aria-label="Close" size="small" onClick={() => navigate('/')}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </Box>
      <Box sx={{ flex: 1, minHeight: 0, minWidth: 0, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        {outlet}
      </Box>
      <ResizeHandle
        mode="e"
        label="Resize Width"
        box={frame}
        place={place}
        sx={{ top: 44, right: 0, width: 8, bottom: 8, cursor: 'ew-resize' }}
      />
      <ResizeHandle
        mode="s"
        label="Resize Height"
        box={frame}
        place={place}
        sx={{ left: 0, right: 8, bottom: 0, height: 8, cursor: 'ns-resize' }}
      />
      <ResizeHandle
        mode="se"
        label="Resize"
        box={frame}
        place={place}
        sx={{ right: 0, bottom: 0, width: 16, height: 16, cursor: 'nwse-resize' }}
      />
    </Box>
  )
}
