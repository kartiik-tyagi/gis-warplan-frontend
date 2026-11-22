import { Icon } from 'ol/style'
import { httpBlob, httpText } from '../shared/api/http'
import { iconCssVars, resolveThemedSvg } from '../shared/icons/iconTheme'
import { isSvgPath } from '../shared/icons/svgDocument'

const iconUrls = new Map()

/** Longest side of every map symbol, in screen pixels. Zoom does not change it. */
export const MAP_ICON_PX = 32

export const CLUSTER_DISTANCE = 42
export const CLUSTER_MIN_DISTANCE = 18

function themeStamp(theme) {
  return Object.entries(iconCssVars(theme)).map(([name, value]) => `${name}=${value}`).join(';')
}

export function iconKey(path, theme) {
  return `${path}\n${themeStamp(theme)}`
}

export function cachedIcon(path, theme) {
  if (!path) return null
  return iconUrls.get(iconKey(path, theme)) || null
}

function positiveLength(value) {
  const text = String(value ?? '').trim()
  if (!text || text.endsWith('%')) return 0
  const number = Number.parseFloat(text)
  return number > 0 ? number : 0
}

/** The canvas the author saved. Display size is chosen later, from this. */
export function canvasSize(markup) {
  const fallback = { width: 24, height: 24 }
  if (typeof DOMParser === 'undefined') return fallback
  const root = new DOMParser().parseFromString(String(markup || ''), 'image/svg+xml').documentElement
  if (!root || root.localName !== 'svg') return fallback
  const box = (root.getAttribute('viewBox') || '').trim().split(/[\s,]+/).map(Number)
  const boxW = box.length === 4 && box[2] > 0 ? box[2] : fallback.width
  const boxH = box.length === 4 && box[3] > 0 ? box[3] : fallback.height
  return {
    width: positiveLength(root.getAttribute('width')) || boxW,
    height: positiveLength(root.getAttribute('height')) || boxH,
  }
}

function measureImage(url) {
  return new Promise((resolve) => {
    const image = new Image()
    image.onload = () => resolve({
      width: image.naturalWidth > 0 ? image.naturalWidth : MAP_ICON_PX,
      height: image.naturalHeight > 0 ? image.naturalHeight : MAP_ICON_PX,
    })
    image.onerror = () => resolve({ width: MAP_ICON_PX, height: MAP_ICON_PX })
    image.src = url
  })
}

/** In-memory copy only. The saved file keeps the author's canvas. */
function presentSvg(markup, theme) {
  const size = canvasSize(markup)
  const themed = resolveThemedSvg(markup, theme)
  if (typeof DOMParser === 'undefined' || typeof XMLSerializer === 'undefined') {
    return { markup: themed, ...size }
  }
  const root = new DOMParser().parseFromString(themed, 'image/svg+xml').documentElement
  if (!root || root.localName !== 'svg') return { markup: themed, ...size }
  root.setAttribute('width', String(size.width))
  root.setAttribute('height', String(size.height))
  if (!root.getAttribute('viewBox')) root.setAttribute('viewBox', `0 0 ${size.width} ${size.height}`)
  return { markup: new XMLSerializer().serializeToString(root), ...size }
}

export function loadIcon(path, theme) {
  if (!path) return Promise.resolve(null)
  const key = iconKey(path, theme)
  if (iconUrls.has(key)) return Promise.resolve(iconUrls.get(key))
  const request = isSvgPath(path)
    ? httpText('/icons/content', { query: { path } }).then((markup) => {
        const presented = presentSvg(markup, theme)
        return {
          url: URL.createObjectURL(new Blob([presented.markup], { type: 'image/svg+xml' })),
          width: presented.width,
          height: presented.height,
        }
      })
    : httpBlob('/icons/content', { query: { path } }).then((blob) => {
        const url = URL.createObjectURL(blob)
        return measureImage(url).then((size) => ({ url, ...size }))
      })
  return request
    .then((record) => {
      iconUrls.set(key, record)
      return record
    })
    .catch(() => null)
}

/**
 * One screen size for every icon. The saved canvas is unchanged; the long side
 * is fitted to MAP_ICON_PX and the shape is kept. The result is in pixels, so
 * zooming the map does not grow or shrink the symbol.
 */
export function mapSymbol(record) {
  if (!record?.url) return null
  const width = record.width > 0 ? record.width : 1
  const height = record.height > 0 ? record.height : 1
  const longest = Math.max(width, height)
  const displayWidth = (MAP_ICON_PX * width) / longest
  const displayHeight = (MAP_ICON_PX * height) / longest
  return {
    image: new Icon({
      src: record.url,
      width: displayWidth,
      height: displayHeight,
      anchor: [0.5, 0.5],
    }),
    offsetY: -(displayHeight / 2 + 6),
  }
}

export function finite(value) {
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

export function membersOf(feature) {
  return feature?.get('features') || []
}

/**
 * Same grouping as OpenLayers: a point joins the first seed whose square of
 * CLUSTER_DISTANCE pixels contains it. Feature order is the source order.
 */
export function clusterGroups(features, resolution) {
  const reach = CLUSTER_DISTANCE * resolution
  const used = new Set()
  const groups = []
  for (const feature of features) {
    if (used.has(feature)) continue
    const origin = feature.getGeometry()?.getCoordinates()
    if (!origin) continue
    const group = []
    for (const neighbor of features) {
      if (used.has(neighbor)) continue
      const point = neighbor.getGeometry()?.getCoordinates()
      if (!point) continue
      if (Math.abs(point[0] - origin[0]) <= reach && Math.abs(point[1] - origin[1]) <= reach) {
        used.add(neighbor)
        group.push(neighbor)
      }
    }
    groups.push(group)
  }
  return groups
}

/** Next zoom at which the clicked group is no longer one cluster. Null when zoom cannot separate them. */
export function zoomUntilOneSeparates(view, features, members) {
  const start = view.getZoom()
  const max = view.getMaxZoom()
  if (start == null || members.length < 2) return null
  const wanted = new Set(members)
  const together = (zoom) => clusterGroups(features, view.getResolutionForZoom(zoom)).some((group) => {
    let count = 0
    for (const feature of group) if (wanted.has(feature)) count += 1
    return count === members.length
  })
  const last = Math.floor(max * 10)
  for (let tenths = Math.floor(start * 10) + 1; tenths <= last; tenths += 1) {
    const zoom = tenths / 10
    if (!together(zoom)) return zoom
  }
  return null
}
