import { useEffect, useRef, useState } from 'react'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import {
  Alert,
  Box,
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
import { useTheme } from '@mui/material/styles'
import NearMeOutlinedIcon from '@mui/icons-material/NearMeOutlined'
import GestureIcon from '@mui/icons-material/Gesture'
import ShowChartIcon from '@mui/icons-material/ShowChart'
import CropSquareIcon from '@mui/icons-material/CropSquare'
import RadioButtonUncheckedIcon from '@mui/icons-material/RadioButtonUnchecked'
import ChangeHistoryIcon from '@mui/icons-material/ChangeHistory'
import TitleIcon from '@mui/icons-material/Title'
import UndoIcon from '@mui/icons-material/Undo'
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined'
import RotateLeftIcon from '@mui/icons-material/RotateLeft'
import RotateRightIcon from '@mui/icons-material/RotateRight'
import FormatColorFillIcon from '@mui/icons-material/FormatColorFill'
import CheckBoxOutlineBlankIcon from '@mui/icons-material/CheckBoxOutlineBlank'
import BorderOuterIcon from '@mui/icons-material/BorderOuter'
import HorizontalRuleIcon from '@mui/icons-material/HorizontalRule'
import MoreHorizIcon from '@mui/icons-material/MoreHoriz'
import GrainIcon from '@mui/icons-material/Grain'
import CleaningServicesOutlinedIcon from '@mui/icons-material/CleaningServicesOutlined'
import CloseIcon from '@mui/icons-material/Close'
import DoneIcon from '@mui/icons-material/Done'
import FlipToBackIcon from '@mui/icons-material/FlipToBack'
import FlipToFrontIcon from '@mui/icons-material/FlipToFront'
import RestartAltIcon from '@mui/icons-material/RestartAlt'
import SaveOutlinedIcon from '@mui/icons-material/SaveOutlined'
import { IconAction } from '../../shared/ui/IconAction'
import { drawIcon } from '../../shared/api/assets'
import { httpText } from '../../shared/api/http'
import { ICON_TOKENS, iconCssVars } from '../../shared/icons/iconTheme'
import {
  applyHandle,
  bounds,
  centerOf,
  cssPaint,
  dashArray,
  handles,
  hitShape,
  newId,
  parseIcon,
  serializeIcon,
  translateShape,
} from '../../shared/icons/svgDocument'
import { logger } from '../../shared/lib/logger'
import { LoadingState } from '../../shared/ui/LoadingState'
import { forgetIconPreview, invalidateIconLabels } from '../../shared/ui/IconPicker'
import { useToastStore } from '../feedback/useToastStore'

const TOOLS = [
  { id: 'select', label: 'Select', Icon: NearMeOutlinedIcon },
  { id: 'freehand', label: 'Draw', Icon: GestureIcon },
  { id: 'line', label: 'Line', Icon: ShowChartIcon },
  { id: 'rect', label: 'Rectangle', Icon: CropSquareIcon },
  { id: 'ellipse', label: 'Ellipse', Icon: RadioButtonUncheckedIcon },
  { id: 'polygon', label: 'Polygon', Icon: ChangeHistoryIcon },
  { id: 'text', label: 'Text', Icon: TitleIcon },
  { id: 'eraser', label: 'Eraser', Icon: CleaningServicesOutlinedIcon },
]

const DEFAULT_PAINT = {
  fill: { mode: 'token', token: 'primary' },
  stroke: { mode: 'none' },
  strokeWidth: 1.5,
  opacity: 1,
  fontSize: 4,
  wording: 'Text',
  dash: 'solid',
  corner: 0,
}

const DEFAULT_BOX = { x: 0, y: 0, w: 24, h: 24 }

function lookOf(fill, stroke) {
  const filled = fill && fill.mode !== 'none'
  const stroked = stroke && stroke.mode !== 'none'
  if (filled && stroked) return 'both'
  if (!filled && stroked) return 'outline'
  return 'filled'
}

function fileNameFrom(input) {
  const stem = String(input || '').trim().replace(/\.svg$/i, '')
  return `${stem}.svg`
}

function validFileName(input) {
  return /^[A-Za-z0-9][A-Za-z0-9._-]{0,95}\.svg$/.test(fileNameFrom(input))
}

function appearance(paint, kind) {
  const opacity = Number(paint.opacity)
  const strokeWidth = Number(paint.strokeWidth) || 1.5
  const safeOpacity = Number.isFinite(opacity) ? opacity : 1
  const dash = paint.dash && paint.dash !== 'solid' ? paint.dash : undefined
  if (kind === 'stroke') {
    const stroke = paint.stroke?.mode !== 'none'
      ? paint.stroke
      : paint.fill?.mode !== 'none'
        ? paint.fill
        : { mode: 'token', token: 'primary' }
    return { fill: { mode: 'none' }, stroke, strokeWidth, opacity: safeOpacity, dash, lineCap: 'round', lineJoin: 'round' }
  }
  return {
    fill: paint.fill || { mode: 'token', token: 'primary' },
    stroke: paint.stroke || { mode: 'none' },
    strokeWidth,
    opacity: safeOpacity,
    dash,
  }
}

function squarePoint(origin, point) {
  const size = Math.max(Math.abs(point.x - origin.x), Math.abs(point.y - origin.y))
  return {
    x: origin.x + Math.sign(point.x - origin.x || 1) * size,
    y: origin.y + Math.sign(point.y - origin.y || 1) * size,
  }
}

function rectBetween(origin, point, shift, paint) {
  const end = shift ? squarePoint(origin, point) : point
  const x = Math.min(origin.x, end.x)
  const y = Math.min(origin.y, end.y)
  const width = Math.abs(end.x - origin.x)
  const height = Math.abs(end.y - origin.y)
  if (width < 0.4 || height < 0.4) return null
  const corner = Math.max(0, Math.min(Math.min(width, height) / 2, Number(paint.corner) || 0))
  return {
    id: 'draft',
    type: 'rect',
    x,
    y,
    width,
    height,
    rx: corner || undefined,
    ry: corner || undefined,
    ...appearance(paint, 'fill'),
  }
}

function ellipseBetween(origin, point, shift, paint) {
  const end = shift ? squarePoint(origin, point) : point
  const rx = Math.abs(end.x - origin.x) / 2
  const ry = Math.abs(end.y - origin.y) / 2
  if (rx < 0.4 || ry < 0.4) return null
  return {
    id: 'draft',
    type: 'ellipse',
    cx: (origin.x + end.x) / 2,
    cy: (origin.y + end.y) / 2,
    rx,
    ry,
    ...appearance(paint, 'fill'),
  }
}

function eraserRadius(viewBox) {
  return Math.max(0.7, Math.max(viewBox.w, viewBox.h) / 14)
}

function pointDistance(a, b) {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

function insideEraser(point, center, radius) {
  return pointDistance(point, center) <= radius
}

function roundCoord(value) {
  return Math.round(value * 10) / 10
}

function circleHole(cx, cy, radius) {
  const k = radius * 0.5522847498
  const n = roundCoord
  return `M ${n(cx - radius)} ${n(cy)} C ${n(cx - radius)} ${n(cy - k)} ${n(cx - k)} ${n(cy - radius)} ${n(cx)} ${n(cy - radius)} C ${n(cx + k)} ${n(cy - radius)} ${n(cx + radius)} ${n(cy - k)} ${n(cx + radius)} ${n(cy)} C ${n(cx + radius)} ${n(cy + k)} ${n(cx + k)} ${n(cy + radius)} ${n(cx)} ${n(cy + radius)} C ${n(cx - k)} ${n(cy + radius)} ${n(cx - radius)} ${n(cy + k)} ${n(cx - radius)} ${n(cy)} Z`
}

function shapeHasFill(shape) {
  return Boolean(shape.fill && shape.fill.mode !== 'none')
}

function densify(points, step) {
  if (!points?.length) return []
  const out = []
  for (let index = 0; index < points.length - 1; index += 1) {
    const start = points[index]
    const end = points[index + 1]
    const pieces = Math.max(1, Math.ceil(pointDistance(start, end) / step))
    for (let piece = 0; piece < pieces; piece += 1) {
      const t = piece / pieces
      out.push({ x: start.x + (end.x - start.x) * t, y: start.y + (end.y - start.y) * t })
    }
  }
  out.push(points[points.length - 1])
  return out
}

function splitAway(points, center, radius) {
  const runs = []
  let run = []
  points.forEach((point) => {
    if (insideEraser(point, center, radius)) {
      if (run.length >= 2) runs.push(run)
      run = []
      return
    }
    run.push(point)
  })
  if (run.length >= 2) runs.push(run)
  return runs
}

function lineCuts(shape, center, radius) {
  const start = { x: shape.x1, y: shape.y1 }
  const end = { x: shape.x2, y: shape.y2 }
  const dx = end.x - start.x
  const dy = end.y - start.y
  const fx = start.x - center.x
  const fy = start.y - center.y
  const a = dx * dx + dy * dy
  const b = 2 * (fx * dx + fy * dy)
  const c = fx * fx + fy * fy - radius * radius
  const disc = b * b - 4 * a * c
  if (a === 0 || disc < 0) return []
  const root = Math.sqrt(disc)
  return [(-b - root) / (2 * a), (-b + root) / (2 * a)]
    .filter((t) => t >= 0 && t <= 1)
    .sort((left, right) => left - right)
    .map((t) => ({ x: start.x + dx * t, y: start.y + dy * t }))
}

function eraseLine(shape, center, radius) {
  const start = { x: shape.x1, y: shape.y1 }
  const end = { x: shape.x2, y: shape.y2 }
  const startIn = insideEraser(start, center, radius)
  const endIn = insideEraser(end, center, radius)
  const cuts = lineCuts(shape, center, radius)
  if (startIn && endIn) return []
  if (!cuts.length) return [shape]
  if (startIn) return [{ ...shape, x1: cuts[cuts.length - 1].x, y1: cuts[cuts.length - 1].y }]
  if (endIn) return [{ ...shape, x2: cuts[0].x, y2: cuts[0].y }]
  if (cuts.length < 2) return [shape]
  return [
    { ...shape, x2: cuts[0].x, y2: cuts[0].y },
    { ...shape, id: newId(), x1: cuts[1].x, y1: cuts[1].y },
  ]
}

function outlineOf(shape) {
  if (shape.type === 'rect') {
    return [
      { x: shape.x, y: shape.y },
      { x: shape.x + shape.width, y: shape.y },
      { x: shape.x + shape.width, y: shape.y + shape.height },
      { x: shape.x, y: shape.y + shape.height },
      { x: shape.x, y: shape.y },
    ]
  }
  if (shape.type === 'polygon') return [...(shape.points || []), shape.points?.[0]].filter(Boolean)
  if (shape.type === 'ellipse' || shape.type === 'circle') {
    const rx = shape.type === 'circle' ? shape.r : shape.rx
    const ry = shape.type === 'circle' ? shape.r : shape.ry
    const points = []
    for (let step = 0; step <= 24; step += 1) {
      const angle = (Math.PI * 2 * step) / 24
      points.push({ x: shape.cx + Math.cos(angle) * rx, y: shape.cy + Math.sin(angle) * ry })
    }
    return points
  }
  return []
}

function outerPath(shape) {
  if (shape.type === 'path') return shape.d
  if (shape.type === 'rect') {
    const right = roundCoord(shape.x + shape.width)
    const bottom = roundCoord(shape.y + shape.height)
    return `M ${roundCoord(shape.x)} ${roundCoord(shape.y)} H ${right} V ${bottom} H ${roundCoord(shape.x)} Z`
  }
  if (shape.type === 'circle') return circleHole(shape.cx, shape.cy, shape.r)
  if (shape.type === 'ellipse') {
    const k = 0.5522847498
    const { cx, cy, rx, ry } = shape
    const n = roundCoord
    return `M ${n(cx - rx)} ${n(cy)} C ${n(cx - rx)} ${n(cy - ry * k)} ${n(cx - rx * k)} ${n(cy - ry)} ${n(cx)} ${n(cy - ry)} C ${n(cx + rx * k)} ${n(cy - ry)} ${n(cx + rx)} ${n(cy - ry * k)} ${n(cx + rx)} ${n(cy)} C ${n(cx + rx)} ${n(cy + ry * k)} ${n(cx + rx * k)} ${n(cy + ry)} ${n(cx)} ${n(cy + ry)} C ${n(cx - rx * k)} ${n(cy + ry)} ${n(cx - rx)} ${n(cy + ry * k)} ${n(cx - rx)} ${n(cy)} Z`
  }
  if (shape.type === 'polygon' && shape.points?.length) {
    return `${shape.points.map((point, index) => `${index ? 'L' : 'M'} ${roundCoord(point.x)} ${roundCoord(point.y)}`).join(' ')} Z`
  }
  return ''
}

function punch(shape, center, radius) {
  const outer = outerPath(shape)
  if (!outer) return []
  return [{
    id: shape.id,
    type: 'path',
    d: `${outer} ${circleHole(center.x, center.y, radius)}`,
    fillRule: 'evenodd',
    fill: shape.fill,
    stroke: shape.stroke,
    strokeWidth: shape.strokeWidth,
    opacity: shape.opacity,
    dash: shape.dash,
    lineCap: shape.lineCap,
    lineJoin: shape.lineJoin,
    rotation: shape.rotation,
  }]
}

function eraseOne(shape, center, radius) {
  if (shape.type === 'line') return eraseLine(shape, center, radius)
  if (shape.type === 'polyline') {
    const runs = splitAway(densify(shape.points, radius / 2), center, radius)
    return runs.map((points, index) => ({ ...shape, id: index ? newId() : shape.id, points }))
  }
  if (shape.type === 'text') return hitShape(shape, center, radius) ? [] : [shape]
  const outline = outlineOf(shape)
  if (!shapeHasFill(shape) && outline.length > 1) {
    const runs = splitAway(densify(outline, radius / 2), center, radius)
    if (runs.length === 1 && runs[0].length === outline.length) return [shape]
    return runs.map((points) => ({
      ...shape,
      id: newId(),
      type: 'polyline',
      points,
      fill: { mode: 'none' },
    }))
  }
  if (hitShape(shape, center, radius)) return punch(shape, center, radius)
  return [shape]
}

function eraseShapes(shapes, center, radius) {
  return shapes.flatMap((shape) => eraseOne(shape, center, radius))
}

function clientToSvg(event, svg) {
  const point = svg.createSVGPoint()
  point.x = event.clientX
  point.y = event.clientY
  const matrix = svg.getScreenCTM()
  if (!matrix) return { x: 0, y: 0 }
  const mapped = point.matrixTransform(matrix.inverse())
  return { x: Math.round(mapped.x * 10) / 10, y: Math.round(mapped.y * 10) / 10 }
}

function replaceShape(list, id, shape) {
  return list.map((item) => (item.id === id ? shape : item))
}

const FIXED_COLOURS = [
  { id: 'green', label: 'Green', color: '#2f9e44' },
  { id: 'red', label: 'Red', color: '#e03131' },
  { id: 'blue', label: 'Blue', color: '#1c7ed6' },
  { id: 'yellow', label: 'Yellow', color: '#f59f00' },
  { id: 'white', label: 'White', color: '#ffffff' },
  { id: 'black', label: 'Black', color: '#1a1a1a' },
]

function paintKind(paint) {
  if (!paint || paint.mode === 'none') return 'none'
  if (paint.mode === 'locked') return 'fixed'
  return 'theme'
}

function hexForInput(color) {
  const text = String(color || '').trim()
  if (/^#[0-9a-fA-F]{6}$/.test(text)) return text
  const short = /^#([0-9a-fA-F])([0-9a-fA-F])([0-9a-fA-F])$/.exec(text)
  if (short) return `#${short[1]}${short[1]}${short[2]}${short[2]}${short[3]}${short[3]}`
  return '#c0392b'
}

function ShapeNode({ shape }) {
  const angle = Number(shape.rotation) || 0
  const center = angle ? centerOf(shape) : null
  const shared = {
    fill: cssPaint(shape.fill),
    stroke: shape.stroke?.mode === 'none' ? 'none' : cssPaint(shape.stroke),
    strokeWidth: shape.stroke?.mode === 'none' ? undefined : shape.strokeWidth,
    strokeLinecap: shape.lineCap,
    strokeLinejoin: shape.lineJoin,
    strokeDasharray: dashArray(shape.dash, shape.strokeWidth) || undefined,
    opacity: shape.opacity != null && shape.opacity < 1 ? shape.opacity : undefined,
    transform: angle ? `rotate(${angle} ${center.x} ${center.y})` : (shape.transform || undefined),
  }
  switch (shape.type) {
    case 'rect':
      return <rect x={shape.x} y={shape.y} width={shape.width} height={shape.height} rx={shape.rx} ry={shape.ry} {...shared} />
    case 'ellipse':
      return <ellipse cx={shape.cx} cy={shape.cy} rx={shape.rx} ry={shape.ry} {...shared} />
    case 'circle':
      return <circle cx={shape.cx} cy={shape.cy} r={shape.r} {...shared} />
    case 'line':
      return <line x1={shape.x1} y1={shape.y1} x2={shape.x2} y2={shape.y2} {...shared} />
    case 'polygon':
      return <polygon points={(shape.points || []).map((p) => `${p.x},${p.y}`).join(' ')} {...shared} />
    case 'polyline':
      return <polyline points={(shape.points || []).map((p) => `${p.x},${p.y}`).join(' ')} {...shared} />
    case 'path':
      return <path d={shape.d} {...shared} />
    case 'text':
      return (
        <text x={shape.x} y={shape.y} fontSize={shape.fontSize || 4} fontFamily="Roboto, sans-serif" textAnchor={shape.textAnchor || 'middle'} {...shared}>
          {shape.text}
        </text>
      )
    default:
      return null
  }
}

function PaintField({ label, value, onChange }) {
  const kind = paintKind(value)
  const token = value?.mode === 'token' && ICON_TOKENS.some((item) => item.id === value.token) ? value.token : 'primary'
  const fixed = hexForInput(value?.color).toLowerCase()
  return (
    <Stack spacing={0.75}>
      <SearchSelect
        size="small"
        label={label}
        options={[{ id: 'theme', name: 'Side Icon Color' }, { id: 'fixed', name: 'Fixed Colour' }, { id: 'none', name: 'None' }]}
        value={kind}
        onChange={(next) => {
          if (next === 'none') onChange({ mode: 'none' })
          else if (next === 'fixed') onChange({ mode: 'locked', color: value?.mode === 'locked' ? hexForInput(value.color) : '#2f9e44' })
          else onChange({ mode: 'token', token })
        }}
        getOptionLabel={(item) => item.name}
        getOptionValue={(item) => item.id}
      />
      {kind === 'theme' ? (
        <SearchSelect
          size="small"
          label="Which Colour Token"
          options={ICON_TOKENS}
          value={token}
          onChange={(id) => onChange({ mode: 'token', token: id })}
          getOptionLabel={(item) => item.label}
          getOptionValue={(item) => item.id}
        />
      ) : null}
      {kind === 'fixed' ? (
        <Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
          {FIXED_COLOURS.map((swatch) => (
            <Box
              key={swatch.id}
              component="button"
              type="button"
              aria-label={`${label} ${swatch.label}`}
              aria-pressed={fixed === swatch.color}
              onClick={() => onChange({ mode: 'locked', color: swatch.color })}
              sx={{
                width: 22,
                height: 22,
                p: 0,
                borderRadius: 0.5,
                bgcolor: swatch.color,
                border: 2,
                borderColor: fixed === swatch.color ? 'primary.main' : 'divider',
                cursor: 'pointer',
              }}
            />
          ))}
          <Box
            component="input"
            type="color"
            aria-label={`${label} fixed colour`}
            value={fixed}
            onChange={(event) => onChange({ mode: 'locked', color: event.target.value })}
            sx={{ width: 28, height: 22, p: 0, border: 1, borderColor: 'divider', bgcolor: 'transparent', cursor: 'pointer' }}
          />
        </Stack>
      ) : null}
    </Stack>
  )
}

export function IconStudio({ open, mode = 'create', directory = '', path = '', initialLabel = '', onClose, onSaved }) {
  const theme = useTheme()
  const push = useToastStore((state) => state.push)
  const svgRef = useRef(null)
  const shapesRef = useRef([])
  const pastRef = useRef([])
  const toolRef = useRef('select')
  const paintRef = useRef(DEFAULT_PAINT)
  const viewBoxRef = useRef(DEFAULT_BOX)
  const draftRef = useRef(null)
  const selectedRef = useRef(null)
  const dragRef = useRef(null)
  const historyMarkRef = useRef(false)
  const apiRef = useRef({})

  const [shapes, setShapes] = useState([])
  const [past, setPast] = useState([])
  const [tool, setTool] = useState('select')
  const [paint, setPaint] = useState(DEFAULT_PAINT)
  const [viewBox, setViewBox] = useState(DEFAULT_BOX)
  const [draft, setDraft] = useState(null)
  const [selectedId, setSelectedId] = useState(null)
  const [name, setName] = useState('')
  const [label, setLabel] = useState('')
  const [lossy, setLossy] = useState(false)
  const [loading, setLoading] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [cursor, setCursor] = useState(null)

  shapesRef.current = shapes
  viewBoxRef.current = viewBox
  toolRef.current = tool
  paintRef.current = paint
  selectedRef.current = selectedId

  function setShapesSafe(next) {
    shapesRef.current = next
    setShapes(next)
  }

  function select(id) {
    historyMarkRef.current = false
    selectedRef.current = id
    setSelectedId(id)
  }

  function pushPast(snapshot) {
    const next = [...pastRef.current.slice(-39), structuredClone(snapshot)]
    pastRef.current = next
    setPast(next)
  }

  function updateSelected(partial) {
    const id = selectedRef.current
    if (!id) return
    if (!historyMarkRef.current) {
      pushPast(shapesRef.current)
      historyMarkRef.current = true
    }
    setShapesSafe(shapesRef.current.map((shape) => (shape.id === id ? { ...shape, ...partial } : shape)))
  }

  function undo() {
    if (dragRef.current) return
    const history = pastRef.current
    if (!history.length) return
    const previous = history[history.length - 1]
    pastRef.current = history.slice(0, -1)
    setPast(pastRef.current)
    setShapesSafe(structuredClone(previous))
    select(null)
  }

  function removeSelected() {
    const id = selectedRef.current
    if (!id) return
    const before = shapesRef.current
    if (!before.some((shape) => shape.id === id)) return
    pushPast(before)
    setShapesSafe(before.filter((shape) => shape.id !== id))
    select(null)
  }

  function finishPolygon() {
    const current = draftRef.current
    if (!current || current.type !== 'polygon' || current.points.length < 3) return
    const shape = { id: newId(), type: 'polygon', points: current.points, ...appearance(paintRef.current, 'fill') }
    pushPast(shapesRef.current)
    setShapesSafe([...shapesRef.current, shape])
    draftRef.current = null
    setDraft(null)
    select(shape.id)
    setTool('select')
  }

  function clearCanvas() {
    if (!shapesRef.current.length) return
    pushPast(shapesRef.current)
    setShapesSafe([])
    draftRef.current = null
    setDraft(null)
    select(null)
  }

  function reorder(step) {
    const id = selectedRef.current
    const list = shapesRef.current
    const index = list.findIndex((shape) => shape.id === id)
    const next = index + step
    if (index < 0 || next < 0 || next >= list.length) return
    const copy = list.slice()
    const [item] = copy.splice(index, 1)
    copy.splice(next, 0, item)
    pushPast(list)
    setShapesSafe(copy)
  }

  apiRef.current = { undo, removeSelected, finishPolygon, close: onClose }

  useEffect(() => {
    if (!open) return undefined
    setError('')
    setBusy(false)
    setLossy(false)
    pastRef.current = []
    setPast([])
    draftRef.current = null
    setDraft(null)
    dragRef.current = null
    select(null)
    setTool('select')
    setPaint(DEFAULT_PAINT)
    if (mode === 'create') {
      setViewBox(DEFAULT_BOX)
      setShapesSafe([])
      setName('')
      setLabel('')
      setLoading(false)
      return undefined
    }
    let live = true
    setLoading(true)
    setShapesSafe([])
    httpText('/assets/content', { query: { path } })
      .then((markup) => {
        if (!live) return
        const parsed = parseIcon(markup)
        if (parsed.error) {
          setError(parsed.error)
          setShapesSafe([])
        } else {
          setViewBox(parsed.viewBox)
          setShapesSafe(parsed.shapes)
          setLossy(parsed.lossy)
        }
        setLabel(initialLabel && initialLabel !== path.split('/').pop() ? initialLabel : '')
        const file = (path.split('/').pop() || 'icon.svg').replace(/\.svg$/i, '')
        setName(`${file}-copy`)
        setLoading(false)
      })
      .catch((failure) => {
        if (!live) return
        setError(failure?.message || 'The icon could not be opened.')
        setLoading(false)
      })
    return () => {
      live = false
    }
  }, [open, mode, path, initialLabel])

  useEffect(() => {
    if (!open) return undefined
    function onKey(event) {
      const tag = event.target?.tagName
      const typing = tag === 'INPUT' || tag === 'TEXTAREA' || event.target?.isContentEditable
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
        event.preventDefault()
        apiRef.current.undo()
        return
      }
      if (typing) return
      if (event.key === 'Escape') {
        event.preventDefault()
        if (draftRef.current) {
          draftRef.current = null
          setDraft(null)
          return
        }
        if (selectedRef.current) {
          select(null)
          return
        }
        apiRef.current.close?.()
      } else if (event.key === 'Delete' || event.key === 'Backspace') {
        event.preventDefault()
        apiRef.current.removeSelected()
      } else if (event.key === 'Enter' && toolRef.current === 'polygon') {
        event.preventDefault()
        apiRef.current.finishPolygon()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  function onPointerDown(event) {
    if (event.button !== 0 || loading) return
    const svg = svgRef.current
    if (!svg) return
    const p = clientToSvg(event, svg)
    const currentTool = toolRef.current
    svg.setPointerCapture(event.pointerId)
    if (currentTool === 'polygon') {
      const points = [...(draftRef.current?.points || []), p]
      const next = { type: 'polygon', points }
      draftRef.current = next
      setDraft(next)
      return
    }
    if (currentTool === 'text') {
      const shape = {
        id: newId(),
        type: 'text',
        x: p.x,
        y: p.y,
        text: (paintRef.current.wording || 'Text').slice(0, 80) || 'Text',
        fontSize: Number(paintRef.current.fontSize) || 4,
        textAnchor: 'middle',
        ...appearance(paintRef.current, 'fill'),
      }
      pushPast(shapesRef.current)
      setShapesSafe([...shapesRef.current, shape])
      select(shape.id)
      setTool('select')
      return
    }
    if (currentTool === 'eraser') {
      const radius = eraserRadius(viewBoxRef.current)
      const before = shapesRef.current
      const next = eraseShapes(before, p, radius)
      dragRef.current = { kind: 'eraser', before: structuredClone(before), changed: JSON.stringify(next) !== JSON.stringify(before) }
      if (dragRef.current.changed) setShapesSafe(next)
      return
    }
    if (currentTool === 'select') {
      const tolerance = Math.max(viewBoxRef.current.w, viewBoxRef.current.h) / 40
      const list = shapesRef.current
      let hit = null
      for (let i = list.length - 1; i >= 0; i -= 1) {
        if (hitShape(list[i], p, tolerance)) {
          hit = list[i]
          break
        }
      }
      if (!hit) {
        select(null)
        return
      }
      select(hit.id)
      dragRef.current = { kind: 'move', origin: p, before: structuredClone(list), base: structuredClone(hit) }
      return
    }
    dragRef.current = { kind: currentTool, origin: p, before: shapesRef.current.slice(), points: [p] }
    if (currentTool === 'freehand') {
      const next = { id: 'draft', type: 'polyline', points: [p], ...appearance(paintRef.current, 'stroke') }
      draftRef.current = next
      setDraft(next)
    }
  }

  function onPointerMove(event) {
    const svg = svgRef.current
    if (!svg) return
    const p = clientToSvg(event, svg)
    if (toolRef.current === 'eraser') setCursor(p)
    else if (cursor) setCursor(null)
    const drag = dragRef.current
    if (!drag) return
    if (drag.kind === 'eraser') {
      const next = eraseShapes(shapesRef.current, p, eraserRadius(viewBoxRef.current))
      if (JSON.stringify(next) !== JSON.stringify(shapesRef.current)) {
        drag.changed = true
        setShapesSafe(next)
      }
      return
    }
    if (drag.kind === 'freehand') {
      const last = drag.points[drag.points.length - 1]
      if (drag.points.length < 250 && Math.hypot(p.x - last.x, p.y - last.y) >= 0.35) drag.points.push(p)
      const next = { id: 'draft', type: 'polyline', points: drag.points.slice(), ...appearance(paintRef.current, 'stroke') }
      draftRef.current = next
      setDraft(next)
      return
    }
    if (drag.kind === 'rect' || drag.kind === 'ellipse' || drag.kind === 'line') {
      const next = drag.kind === 'rect'
        ? rectBetween(drag.origin, p, event.shiftKey, paintRef.current)
        : drag.kind === 'ellipse'
          ? ellipseBetween(drag.origin, p, event.shiftKey, paintRef.current)
          : {
            id: 'draft',
            type: 'line',
            x1: drag.origin.x,
            y1: drag.origin.y,
            x2: p.x,
            y2: p.y,
            ...appearance(paintRef.current, 'stroke'),
          }
      draftRef.current = next
      setDraft(next)
      return
    }
    if (drag.kind === 'move') {
      const moved = translateShape(drag.base, p.x - drag.origin.x, p.y - drag.origin.y)
      setShapesSafe(replaceShape(drag.before, drag.base.id, moved))
      return
    }
    if (drag.kind === 'resize' || drag.kind === 'start' || drag.kind === 'end') {
      setShapesSafe(replaceShape(drag.before, drag.base.id, applyHandle(drag.base, drag.kind, p)))
    }
  }

  function onPointerUp() {
    const drag = dragRef.current
    if (!drag) return
    dragRef.current = null
    if (drag.kind === 'eraser') {
      if (drag.changed) pushPast(drag.before)
      select(null)
      return
    }
    if (drag.kind === 'freehand') {
      const points = drag.points
      draftRef.current = null
      setDraft(null)
      if (points.length >= 2) {
        pushPast(drag.before)
        setShapesSafe([...drag.before, { id: newId(), type: 'polyline', points, ...appearance(paintRef.current, 'stroke') }])
      }
      return
    }
    if (drag.kind === 'rect' || drag.kind === 'ellipse' || drag.kind === 'line') {
      const drawn = draftRef.current
      draftRef.current = null
      setDraft(null)
      if (!drawn) return
      const shape = { ...drawn, id: newId() }
      if (drag.kind === 'line' && Math.hypot(shape.x2 - shape.x1, shape.y2 - shape.y1) < 0.4) return
      pushPast(drag.before)
      setShapesSafe([...drag.before, shape])
      select(shape.id)
      return
    }
    if (JSON.stringify(drag.before) !== JSON.stringify(shapesRef.current)) pushPast(drag.before)
  }

  function onHandleDown(event, kind) {
    event.stopPropagation()
    event.preventDefault()
    const svg = svgRef.current
    const shape = shapesRef.current.find((item) => item.id === selectedRef.current)
    if (!svg || !shape) return
    svg.setPointerCapture(event.pointerId)
    dragRef.current = { kind, before: structuredClone(shapesRef.current), base: structuredClone(shape) }
  }

  function rotateSelected(delta) {
    const id = selectedRef.current
    const shape = shapesRef.current.find((item) => item.id === id)
    if (!shape) return
    const next = Math.round((((Number(shape.rotation) || 0) + delta) % 360) * 10) / 10
    updateSelected({ rotation: next === 0 ? undefined : next })
  }

  function applyLook(kind) {
    const sourceFill = selectedRef.current
      ? shapesRef.current.find((item) => item.id === selectedRef.current)?.fill
      : paintRef.current.fill
    const sourceStroke = selectedRef.current
      ? shapesRef.current.find((item) => item.id === selectedRef.current)?.stroke
      : paintRef.current.stroke
    const ink = (value) => (value && value.mode !== 'none' ? value : { mode: 'token', token: 'primary' })
    const fill = kind === 'outline' ? { mode: 'none' } : ink(sourceFill)
    const stroke = kind === 'filled' ? { mode: 'none' } : ink(sourceStroke?.mode !== 'none' ? sourceStroke : sourceFill)
    const strokeWidth = Math.max(Number(paintRef.current.strokeWidth) || 0, kind === 'filled' ? 0 : 1.5)
    if (!selectedRef.current) {
      const next = { ...paintRef.current, fill, stroke, strokeWidth }
      paintRef.current = next
      setPaint(next)
      return
    }
    if (!historyMarkRef.current) {
      pushPast(shapesRef.current)
      historyMarkRef.current = true
    }
    setShapesSafe(shapesRef.current.map((shape) => (
      shape.id === selectedRef.current ? { ...shape, fill, stroke, strokeWidth } : shape
    )))
  }

  function changePaint(key, value) {
    if (!selectedRef.current) {
      const next = { ...paintRef.current, [key]: value }
      paintRef.current = next
      setPaint(next)
      return
    }
    updateSelected({ [key]: value })
  }

  async function save() {
    if (!shapesRef.current.length) {
      setError('Draw at least one shape.')
      return
    }
    const svg = serializeIcon(viewBoxRef.current, shapesRef.current)
    const trimmedLabel = label.trim()
    const folder = mode === 'create' ? (directory || '') : path.includes('/') ? path.slice(0, path.lastIndexOf('/')) : ''
    const savedName = fileNameFrom(name)
    const originalName = (path.split('/').pop() || '').toLowerCase()
    if (mode !== 'create' && savedName.toLowerCase() === originalName) {
      setError('Choose a new file name. The original icon is left unchanged.')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await drawIcon({
        name: savedName,
        directory: folder,
        label: trimmedLabel,
        svg,
      })
      const saved = result?.path || savedName
      forgetIconPreview(saved)
      invalidateIconLabels()
      logger.info('icons.studio.saved', { path: saved, mode })
      push(mode === 'create' ? `Drew ${saved}.` : `Saved a new icon ${saved}. The original was not changed.`, 'success')
      onSaved?.(saved)
    } catch (failure) {
      const text = failure?.message || 'The icon could not be saved.'
      setError(text)
      push(text, 'error')
      logger.warn('icons.studio.failed', { message: text })
    } finally {
      setBusy(false)
    }
  }

  const selected = shapes.find((shape) => shape.id === selectedId) || null
  const fill = selected ? selected.fill : paint.fill
  const stroke = selected ? selected.stroke : paint.stroke
  const strokeWidth = selected ? selected.strokeWidth : paint.strokeWidth
  const opacity = selected ? selected.opacity : paint.opacity
  const originalName = (path.split('/').pop() || '').toLowerCase()
  const nameOk = validFileName(name) && (mode === 'create' || fileNameFrom(name).toLowerCase() !== originalName)
  const grid = []
  const step = viewBox.w <= 32 ? 2 : viewBox.w / 12
  for (let x = viewBox.x; x <= viewBox.x + viewBox.w + 0.01; x += step) grid.push({ x1: x, y1: viewBox.y, x2: x, y2: viewBox.y + viewBox.h, key: `v${x}` })
  for (let y = viewBox.y; y <= viewBox.y + viewBox.h + 0.01; y += step) grid.push({ x1: viewBox.x, y1: y, x2: viewBox.x + viewBox.w, y2: y, key: `h${y}` })
  const handleRadius = Math.max(viewBox.w, viewBox.h) / 70

  return (
    <Dialog
      open={open}
      onClose={(event, reason) => {
        if (busy || reason === 'escapeKeyDown') return
        onClose?.()
      }}
      fullWidth
      maxWidth="lg"
    >
      <DialogTitle sx={{ pb: 0.5 }}>
        {mode === 'create' ? 'Draw an icon' : 'Save a new icon'}
      </DialogTitle>
      <DialogContent dividers>
        <Stack spacing={1.5}>
          {error ? <Alert severity="error">{error}</Alert> : null}
          {lossy ? <Alert severity="warning">Some parts of the original drawing cannot be edited here. Saving still writes a new file and leaves the original unchanged.</Alert> : null}
          {loading ? <LoadingState label="Opening icon" /> : (
            <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', md: 'minmax(0, 1fr) 240px' }, gap: 1.5, alignItems: 'start' }}>
              <Stack spacing={0.75} sx={{ minWidth: 0 }}>
                <Stack direction="row" spacing={0.5} useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                  <ToggleButtonGroup
                    exclusive
                    size="small"
                    value={tool}
                    onChange={(_, value) => {
                      if (!value) return
                      draftRef.current = null
                      setDraft(null)
                      setTool(value)
                    }}
                    aria-label="Drawing tools"
                  >
                    {TOOLS.map((item) => (
                      <ToggleButton key={item.id} value={item.id} title={item.label} aria-label={item.label} sx={{ px: 0.75 }}>
                        <item.Icon fontSize="small" />
                      </ToggleButton>
                    ))}
                  </ToggleButtonGroup>
                  <ToggleButtonGroup exclusive size="small" value={lookOf(fill, stroke)} onChange={(_, value) => value && applyLook(value)} aria-label="Fill or outline">
                    <ToggleButton value="filled" title="Filled" aria-label="Filled" sx={{ px: 0.75 }}><FormatColorFillIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="outline" title="Outline" aria-label="Outline" sx={{ px: 0.75 }}><CheckBoxOutlineBlankIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="both" title="Filled and outline" aria-label="Filled and outline" sx={{ px: 0.75 }}><BorderOuterIcon fontSize="small" /></ToggleButton>
                  </ToggleButtonGroup>
                  <ToggleButtonGroup exclusive size="small" value={(selected ? selected.dash : paint.dash) || 'solid'} onChange={(_, value) => value && changePaint('dash', value)} aria-label="Stroke line">
                    <ToggleButton value="solid" title="Solid line" aria-label="Solid line" sx={{ px: 0.75 }}><HorizontalRuleIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="dashed" title="Dashed line" aria-label="Dashed line" sx={{ px: 0.75 }}><MoreHorizIcon fontSize="small" /></ToggleButton>
                    <ToggleButton value="dotted" title="Dotted line" aria-label="Dotted line" sx={{ px: 0.75 }}><GrainIcon fontSize="small" /></ToggleButton>
                  </ToggleButtonGroup>
                  <IconAction label="Undo" icon={<UndoIcon fontSize="small" />} disabled={!past.length || busy} onClick={undo} />
                  <IconAction label="Delete shape" icon={<DeleteOutlinedIcon fontSize="small" />} color="error" disabled={!selected || busy} onClick={removeSelected} />
                </Stack>
                {tool === 'polygon' && draft?.points?.length ? (
                  <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
                    <Typography variant="caption" color="text.secondary">{draft.points.length} corners</Typography>
                    <IconAction label="Finish" icon={<DoneIcon fontSize="small" />} disabled={draft.points.length < 3} onClick={finishPolygon} variant="contained" />
                    <IconAction label="Cancel" icon={<CloseIcon fontSize="small" />} onClick={() => { draftRef.current = null; setDraft(null) }} />
                  </Stack>
                ) : null}
                <Box sx={{ width: '100%', maxWidth: 520 }}>
                <Box sx={{ position: 'relative', width: '100%', pt: '100%', border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden' }}>
                  <Box sx={{ position: 'absolute', inset: 0 }}>
                    <svg
                      ref={svgRef}
                      viewBox={`${viewBox.x} ${viewBox.y} ${viewBox.w} ${viewBox.h}`}
                      width="100%"
                      height="100%"
                      role="img"
                      aria-label="Icon canvas"
                      style={{ ...iconCssVars(theme), touchAction: 'none', userSelect: 'none', display: 'block' }}
                      onPointerDown={onPointerDown}
                      onPointerMove={onPointerMove}
                      onPointerUp={onPointerUp}
                      onPointerCancel={onPointerUp}
                    >
                      <rect x={viewBox.x} y={viewBox.y} width={viewBox.w} height={viewBox.h} fill="var(--wp-backgroundPaper)" />
                      <g style={{ pointerEvents: 'none' }}>
                        {grid.map((line) => (
                          <line key={line.key} x1={line.x1} y1={line.y1} x2={line.x2} y2={line.y2} stroke="var(--wp-divider)" strokeWidth={Math.max(viewBox.w, viewBox.h) / 400} />
                        ))}
                        {shapes.map((shape) => <ShapeNode key={shape.id} shape={shape} />)}
                        {draft && draft.type !== 'polygon' ? <ShapeNode shape={draft} /> : null}
                        {draft?.type === 'polygon' ? <polyline points={draft.points.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--wp-primary)" strokeWidth={viewBox.w / 80} /> : null}
                      </g>
                      {tool === 'eraser' && cursor ? (
                        <circle
                          cx={cursor.x}
                          cy={cursor.y}
                          r={eraserRadius(viewBox)}
                          fill="rgba(255,255,255,0.35)"
                          stroke="var(--wp-textPrimary)"
                          strokeWidth={Math.max(viewBox.w, viewBox.h) / 160}
                        />
                      ) : null}
                      {tool === 'select' && selected ? (
                        <g transform={selected.rotation ? `rotate(${selected.rotation} ${centerOf(selected).x} ${centerOf(selected).y})` : undefined}>
                          <Selection shape={selected} viewBox={viewBox} />
                          {handles(selected).map((handle) => (
                            <circle
                              key={handle.kind}
                              cx={handle.x}
                              cy={handle.y}
                              r={handleRadius}
                              fill="var(--wp-info)"
                              stroke="var(--wp-backgroundPaper)"
                              strokeWidth={handleRadius / 3}
                              onPointerDown={(event) => onHandleDown(event, handle.kind)}
                            />
                          ))}
                        </g>
                      ) : null}
                    </svg>
                  </Box>
                </Box>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>{shapes.length} shape{shapes.length === 1 ? '' : 's'}</Typography>
              </Box>
              </Stack>

              <Stack spacing={1.25}>
                <Typography variant="subtitle2">{selected ? 'Selected shape' : 'Next shape'}</Typography>
                <PaintField label="Fill" value={fill} onChange={(value) => changePaint('fill', value)} />
                <PaintField label="Stroke" value={stroke} onChange={(value) => changePaint('stroke', value)} />
                <TextField
                  size="small"
                  label="Stroke Width"
                  type="number"
                  value={strokeWidth ?? 1.5}
                  onChange={(event) => changePaint('strokeWidth', Math.max(0, Math.min(100, Number(event.target.value) || 0)))}
                  slotProps={{ htmlInput: { min: 0, max: 100, step: 0.5 } }}
                />
                <TextField
                  size="small"
                  label="Opacity"
                  type="number"
                  value={opacity ?? 1}
                  onChange={(event) => changePaint('opacity', Math.max(0, Math.min(1, Number(event.target.value))))}
                  slotProps={{ htmlInput: { min: 0, max: 1, step: 0.1 } }}
                />
                {(selected?.type === 'text' || (!selected && tool === 'text')) ? (
                  <>
                    <TextField
                      size="small"
                      label="Wording"
                      value={selected?.type === 'text' ? selected.text : paint.wording}
                      onChange={(event) => {
                        const wording = event.target.value.slice(0, 80)
                        if (selected?.type === 'text') updateSelected({ text: wording })
                        else changePaint('wording', wording)
                      }}
                    />
                    <TextField
                      size="small"
                      label="Text Size"
                      type="number"
                      value={selected?.type === 'text' ? selected.fontSize : paint.fontSize}
                      onChange={(event) => {
                        const fontSize = Math.max(0.5, Math.min(64, Number(event.target.value) || 4))
                        if (selected?.type === 'text') updateSelected({ fontSize })
                        else changePaint('fontSize', fontSize)
                      }}
                      slotProps={{ htmlInput: { min: 0.5, max: 64, step: 0.5 } }}
                    />
                  </>
                ) : null}
                {(selected?.type === 'rect' || (!selected && tool === 'rect')) ? (
                  <TextField
                    size="small"
                    label="Corner radius"
                    type="number"
                    value={selected?.type === 'rect' ? (selected.rx || 0) : (paint.corner || 0)}
                    onChange={(event) => {
                      const corner = Math.max(0, Math.min(48, Number(event.target.value) || 0))
                      if (selected?.type === 'rect') updateSelected({ rx: corner || undefined, ry: corner || undefined })
                      else changePaint('corner', corner)
                    }}
                    slotProps={{ htmlInput: { min: 0, max: 48, step: 0.5 } }}
                  />
                ) : null}
                {selected ? (
                  <Stack spacing={0.5}>
                    <Typography variant="caption" color="text.secondary">Rotation {Math.round(Number(selected.rotation) || 0)}°</Typography>
                    <Stack direction="row" spacing={0.5}>
                      <IconAction label="Rotate left" icon={<RotateLeftIcon fontSize="small" />} onClick={() => rotateSelected(-15)} />
                      <IconAction label="Rotate right" icon={<RotateRightIcon fontSize="small" />} onClick={() => rotateSelected(15)} />
                      <IconAction label="Reset" icon={<RestartAltIcon fontSize="small" />} onClick={() => rotateSelected(-(Number(selected.rotation) || 0))} />
                    </Stack>
                  </Stack>
                ) : null}
                {selected ? (
                  <Stack direction="row" spacing={0.5}>
                    <IconAction label="Forward" icon={<FlipToFrontIcon fontSize="small" />} onClick={() => reorder(1)} />
                    <IconAction label="Back" icon={<FlipToBackIcon fontSize="small" />} onClick={() => reorder(-1)} />
                  </Stack>
                ) : null}
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Canvas Width"
                    type="number"
                    value={viewBox.w}
                    onChange={(event) => {
                      const w = Number(event.target.value)
                      if (w >= 1 && w <= 1024) setViewBox((current) => ({ ...current, w }))
                    }}
                    slotProps={{ htmlInput: { min: 1, max: 1024 } }}
                  />
                  <TextField
                    size="small"
                    label="Canvas Height"
                    type="number"
                    value={viewBox.h}
                    onChange={(event) => {
                      const h = Number(event.target.value)
                      if (h >= 1 && h <= 1024) setViewBox((current) => ({ ...current, h }))
                    }}
                    slotProps={{ htmlInput: { min: 1, max: 1024 } }}
                  />
                </Stack>
              </Stack>
            </Box>
          )}
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 1.5, alignItems: 'flex-start', flexWrap: 'wrap', gap: 1 }}>
        <TextField
          size="small"
          label="File Name"
          value={name}
          onChange={(event) => setName(event.target.value)}
          error={Boolean(name) && !nameOk}
          helperText={name && !nameOk ? 'Letters, numbers, dots, underscores, or hyphens.' : undefined}
          sx={{ minWidth: 220, flex: 1 }}
        />
        <TextField
          size="small"
          label="Label"
          value={label}
          onChange={(event) => setLabel(event.target.value.slice(0, 120))}
          sx={{ minWidth: 200, flex: 1 }}
        />
        <IconAction label="Cancel" icon={<CloseIcon fontSize="small" />} onClick={onClose} disabled={busy} />
        <IconAction
          label={busy ? 'Saving' : 'Save new icon'}
          icon={<SaveOutlinedIcon fontSize="small" />}
          disabled={busy || loading || !shapes.length || !nameOk}
          onClick={save}
          variant="contained"
        />
      </DialogActions>
    </Dialog>
  )
}

function Selection({ shape, viewBox }) {
  const box = bounds(shape)
  const pad = Math.max(viewBox.w, viewBox.h) / 80
  const width = Math.max(viewBox.w, viewBox.h) / 180
  return (
    <rect
      x={box.x - pad}
      y={box.y - pad}
      width={Math.max(pad, box.w) + pad * 2}
      height={Math.max(pad, box.h) + pad * 2}
      fill="none"
      stroke="var(--wp-info)"
      strokeWidth={width}
      strokeDasharray={`${width * 3} ${width * 2}`}
    />
  )
}

export default IconStudio
