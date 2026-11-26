import { useEffect, useRef } from 'react'
import Map from 'ol/Map'
import View from 'ol/View'
import TileLayer from 'ol/layer/Tile'
import TileWMS from 'ol/source/TileWMS'
import Zoom from 'ol/control/Zoom'
import ScaleLine from 'ol/control/ScaleLine'
import { fromLonLat, toLonLat } from 'ol/proj'
import { Box } from '@mui/material'
import 'ol/ol.css'
import { useLocationPick } from '../shared/map/useLocationPick'

function createTileLayer(serviceUrl, filter) {
  if (!serviceUrl || !filter?.layers) return null
  const layer = new TileLayer({
    source: new TileWMS({
      url: serviceUrl,
      params: {
        LAYERS: filter.layers,
        TILED: true,
        VERSION: '1.1.1',
        TRANSPARENT: Boolean(filter.transparent),
      },
      serverType: 'geoserver',
      transition: 0,
      cacheSize: 512,
    }),
    visible: filter.visible !== false,
    opacity: filter.opacity ?? 1,
    minZoom: filter.minZoom == null ? undefined : Number(filter.minZoom),
    maxZoom: filter.maxZoom == null ? undefined : Number(filter.maxZoom),
  })
  layer.set('filterId', filter.id)
  layer.set('wmsLayers', filter.layers)
  return layer
}

function syncMapLayers(map, serviceUrl, layers) {
  const wanted = [...(layers || [])].sort((left, right) => Number(right.base) - Number(left.base))
  const wantedIds = new Set(wanted.map((item) => item.id))
  const existing = map.getLayers().getArray().filter((layer) => layer.get('filterId'))

  for (const layer of existing) {
    const id = layer.get('filterId')
    if (!wantedIds.has(id)) {
      map.removeLayer(layer)
    }
  }

  const currentById = new Map(
    map.getLayers().getArray().filter((layer) => layer.get('filterId')).map((layer) => [layer.get('filterId'), layer]),
  )

  wanted.forEach((filter, index) => {
    let layer = currentById.get(filter.id)
    if (!layer || layer.get('wmsLayers') !== filter.layers) {
      if (layer) map.removeLayer(layer)
      layer = createTileLayer(serviceUrl, filter)
      if (layer) {
        map.getLayers().insertAt(index, layer)
        currentById.set(filter.id, layer)
      }
      return
    }
    layer.setVisible(filter.visible !== false)
    layer.setOpacity(filter.opacity ?? 1)
    if (filter.minZoom != null) layer.setMinZoom(Number(filter.minZoom))
    if (filter.maxZoom != null) layer.setMaxZoom(Number(filter.maxZoom))
  })
}

export default function SituationMap({ view, serviceUrl, layers, resetToken, onPointer, onZoom, onView, onMap, focusKey = null, showControls = true, label = 'Situation map' }) {
  const targetRef = useRef(null)
  const mapRef = useRef(null)
  const viewRef = useRef(view)
  const layersRef = useRef(layers)
  const serviceRef = useRef(serviceUrl)
  const onPointerRef = useRef(onPointer)
  const onZoomRef = useRef(onZoom)
  const onViewRef = useRef(onView)
  const onMapRef = useRef(onMap)
  const skipReset = useRef(true)
  viewRef.current = view
  layersRef.current = layers
  serviceRef.current = serviceUrl
  const layerKey = (layers || []).map((layer) => `${layer.id}:${layer.layers}`).join('|')
  const visibilityKey = (layers || []).map((layer) => `${layer.id}:${layer.visible ? 1 : 0}:${layer.opacity ?? 1}`).join('|')

  useEffect(() => {
    onPointerRef.current = onPointer
    onZoomRef.current = onZoom
    onViewRef.current = onView
    onMapRef.current = onMap
  })

  useEffect(() => {
    const home = viewRef.current || {}
    const map = new Map({
      target: targetRef.current,
      layers: [],
      controls: showControls
        ? [new Zoom(), new ScaleLine({ units: 'metric', bar: true, steps: 4, text: false, minWidth: 100 })]
        : [],
      view: new View({
        center: fromLonLat([Number(home.longitude) || 0, Number(home.latitude) || 0]),
        zoom: Number(home.zoom) || 5,
        minZoom: Number(home.minZoom) || 1,
        maxZoom: Number(home.maxZoom) || 18,
      }),
    })
    mapRef.current = map
    onMapRef.current?.(map)
    syncMapLayers(map, serviceRef.current, layersRef.current)

    map.on('pointermove', (event) => {
      if (event.dragging) return
      const [longitude, latitude] = toLonLat(event.coordinate)
      onPointerRef.current?.({ latitude, longitude })
    })
    map.on('singleclick', (event) => {
      const [longitude, latitude] = toLonLat(event.coordinate)
      useLocationPick.getState().offer(latitude, longitude)
    })

    const publishZoom = () => {
      const mapView = map.getView()
      const zoom = mapView.getZoom()
      const rounded = zoom == null ? null : Math.round(zoom * 10) / 10
      onViewRef.current?.({ zoom: rounded, resolution: mapView.getResolution() ?? null })
      if (rounded != null) onZoomRef.current?.(rounded)
    }
    map.getView().on('change:resolution', publishZoom)
    publishZoom()

    const observer = new ResizeObserver(() => map.updateSize())
    if (targetRef.current) observer.observe(targetRef.current)

    return () => {
      observer.disconnect()
      onMapRef.current?.(null)
      map.setTarget(null)
      mapRef.current = null
    }
  }, [serviceUrl, showControls])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    syncMapLayers(map, serviceUrl, layersRef.current)
  }, [layerKey, serviceUrl])

  useEffect(() => {
    const map = mapRef.current
    if (!map) return
    const current = layersRef.current || []
    map.getLayers().forEach((layer) => {
      const id = layer.get('filterId')
      if (!id) return
      const match = current.find((item) => item.id === id)
      if (match) {
        layer.setVisible(Boolean(match.visible))
        layer.setOpacity(match.opacity ?? 1)
      }
    })
  }, [visibilityKey])

  useEffect(() => {
    if (skipReset.current) {
      skipReset.current = false
      return
    }
    const map = mapRef.current
    const home = viewRef.current
    if (!map || !home) return
    map.getView().animate({
      center: fromLonLat([Number(home.longitude) || 0, Number(home.latitude) || 0]),
      zoom: Number(home.zoom) || 5,
      duration: 350,
    })
  }, [resetToken])

  const focusSeen = useRef(focusKey)
  useEffect(() => {
    if (focusKey == null) return
    if (focusSeen.current === focusKey) return
    focusSeen.current = focusKey
    const map = mapRef.current
    const home = viewRef.current
    if (!map || !home) return
    map.getView().animate({
      center: fromLonLat([Number(home.longitude) || 0, Number(home.latitude) || 0]),
      zoom: Number(home.zoom) || 5,
      duration: 350,
    })
  }, [focusKey])

  return (
    <Box
      ref={targetRef}
      className="situation-map"
      role="application"
      aria-label={label}
      sx={{ position: 'absolute', inset: 0, bgcolor: 'background.default' }}
    />
  )
}
