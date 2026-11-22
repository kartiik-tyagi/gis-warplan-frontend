import { useEffect, useMemo, useRef, useState } from 'react'
import { AirMapCard } from '../air/AirMapCard'
import { Box, Button, Menu, MenuItem, Paper, Typography } from '@mui/material'
import { get } from '../../shared/api/http'
import { FunctionalityCodes, hasFunctionality } from '../../shared/auth/functionalityCodes'
import { themeFromEntity } from '../../shared/api/mappers'
import { createAppTheme } from '../../shared/theme/createAppTheme'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import * as api from './orbatApi'
import { addChild, nodesOf, updateNode } from './orbatDoc'
import { useMapOrbat } from './useMapOrbat'
import { useOrbatPicture } from './useOrbatPicture'

function isAdministrator(session) {
  return (session?.me?.roleCodes || []).includes('ADMINISTRATOR')
}

function pictureNodes(nodes, types) {
  const byId = new Map((types || []).map((type) => [String(type.id), type]))
  return nodes.map((node) => ({
    ...node,
    iconPath: node.iconPath || byId.get(String(node.nodeTypeId))?.iconPath || '',
  }))
}

/** Draws one side's standard or playing ORBAT on the map and creates nodes from a right-click. */
export function MapOrbat({ suspended = false }) {
  const session = useSessionStore((state) => state.session)
  const mode = useMapOrbat((state) => state.mode)
  const push = useToastStore((state) => state.push)
  const [sides, setSides] = useState([])
  const [sideId, setSideId] = useState('')
  const [types, setTypes] = useState([])
  const [record, setRecord] = useState(null)
  const [nodes, setNodes] = useState([])
  const [note, setNote] = useState('')
  const [iconTheme, setIconTheme] = useState(null)
  const [dialog, setDialog] = useState(null)
  const [airNode, setAirNode] = useState(null)
  const [busy, setBusy] = useState(false)
  const nodesRef = useRef([])
  nodesRef.current = nodes
  const menu = useOrbatPicture((state) => state.menu)
  const hover = useOrbatPicture((state) => state.hover)
  const moveToken = useOrbatPicture((state) => state.moveToken)
  const selectToken = useOrbatPicture((state) => state.selectToken)
  const administrator = isAdministrator(session)
  const ownSideId = session?.me?.administeredSideId == null ? '' : String(session.me.administeredSideId)
  const canUseMode = mode === 'standard'
    ? hasFunctionality(session?.functionalities, FunctionalityCodes.MANAGE_STANDARD_ORBAT)
    : mode === 'playing'
      ? hasFunctionality(session?.functionalities, FunctionalityCodes.MANAGE_PLAYING_ORBAT)
      : false
  const gameId = session?.activeGame?.id || ''
  const gameName = session?.activeGame?.name || ''
  const editable = mode === 'standard'
    ? hasFunctionality(session?.functionalities, FunctionalityCodes.MANAGE_STANDARD_ORBAT)
    : mode === 'playing'
      ? hasFunctionality(session?.functionalities, FunctionalityCodes.MANAGE_PLAYING_ORBAT) && record?.metadata?.status !== 'finalized'
      : false
  const side = sides.find((item) => String(item.id) === String(sideId)) || null
  const finalized = mode === 'playing' && record?.metadata?.status === 'finalized'

  useEffect(() => {
    if (!session || sideId || administrator) return undefined
    if (ownSideId) setSideId(ownSideId)
  }, [session, sideId, administrator, ownSideId])

  useEffect(() => {
    if (suspended || !mode) {
      if (!suspended) useOrbatPicture.getState().hide()
      return undefined
    }
    if (!canUseMode) {
      setNote('This account cannot change that ORBAT.')
      useOrbatPicture.getState().hide()
      return undefined
    }
    let live = true
    const load = async () => {
      setNote('Opening…')
      setRecord(null)
      setNodes([])
      try {
        const [sideRows, typeRows] = await Promise.all([api.listSides(), api.listNodeTypes()])
        if (!live) return
        setSides(sideRows || [])
        setTypes(typeRows || [])
        const resolved = administrator ? sideId : ownSideId
        const chosen = (sideRows || []).find((item) => String(item.id) === String(resolved)) || (administrator ? (sideRows || [])[0] : null)
        if (!chosen) {
          setNote(administrator ? 'Choose a side.' : 'This account has no side.')
          useOrbatPicture.getState().hide()
          return
        }
        if (String(chosen.id) !== String(sideId)) setSideId(String(chosen.id))
        let theme = null
        if (chosen.themeId) {
          try {
            const themes = await get('/themes')
            const row = (themes || []).find((item) => String(item.id) === String(chosen.themeId))
            if (row) theme = createAppTheme(themeFromEntity(row))
          } catch {
            theme = null
          }
        }
        if (!live) return
        setIconTheme(theme)
        if (mode === 'playing' && !gameId) {
          setNote('No active game.')
          useOrbatPicture.getState().hide()
          return
        }
        if (mode === 'standard') {
          let orbat = await api.getStandardOrbat(chosen.id)
          if (!orbat) orbat = await api.createStandardOrbat(chosen.id)
          if (!live) return
          const next = nodesOf(orbat.orbatJson)
          setRecord(orbat)
          setNodes(next)
          useOrbatPicture.getState().show(pictureNodes(next, typeRows), chosen.colour || '#2f6fed', true, theme, null)
          setNote('')
          return
        }
        const rows = await api.listPlayingOrbats(gameId)
        const match = (rows || []).find((item) => String(item.sideId) === String(chosen.id))
        if (!live) return
        if (!match) {
          setRecord(null)
          setNodes([])
          useOrbatPicture.getState().hide()
          setNote('This game has no playing ORBAT for this side.')
          return
        }
        const next = nodesOf(match.orbatJson)
        setRecord(match)
        setNodes(next)
        const open = match.metadata?.status !== 'finalized'
        useOrbatPicture.getState().show(pictureNodes(next, typeRows), chosen.colour || '#2f6fed', open, theme, match.id)
        setNote(open ? '' : 'Finalized. Re-edit before changing it.')
      } catch (error) {
        if (!live) return
        setNote(error?.message || 'The ORBAT could not be opened.')
        useOrbatPicture.getState().hide()
      }
    }
    load()
    return () => {
      live = false
    }
  }, [mode, suspended, sideId, gameId, administrator, ownSideId, canUseMode, session?.me?.administeredSideId])

  useEffect(() => {
    if (suspended || !mode || !record) return
    useOrbatPicture.getState().show(
      pictureNodes(nodes, types),
      side?.colour || '#2f6fed',
      editable,
      iconTheme,
      mode === 'playing' ? record.id : null,
    )
  }, [nodes, editable, iconTheme, side?.colour, types, record, mode, suspended])

  useEffect(() => {
    if (!moveToken || suspended || !mode || !editable) return
    const move = useOrbatPicture.getState().move
    if (!move) return
    const next = updateNode(nodesRef.current, move.id, {
      latitude: Math.round(move.latitude * 1e5) / 1e5,
      longitude: Math.round(move.longitude * 1e5) / 1e5,
    })
    setNodes(next)
    persist(next).catch((error) => push(error?.message || 'The ORBAT could not be saved.', 'error'))
  }, [moveToken])

  const persist = async (next) => {
    if (!record || !side) return
    setBusy(true)
    try {
      const body = {
        orbatJson: { ...(record.orbatJson || {}), nodes: next },
        metadata: record.metadata,
        version: record.version,
      }
      const saved = mode === 'standard'
        ? await api.saveStandardOrbat(side.id, body)
        : await api.savePlayingOrbat(gameId, record.id, body)
      setRecord(saved)
      setNodes(nodesOf(saved.orbatJson))
    } finally {
      setBusy(false)
    }
  }

  const reopen = async () => {
    if (!record || !gameId) return
    setBusy(true)
    try {
      const saved = await api.savePlayingOrbat(gameId, record.id, {
        metadata: { ...(record.metadata || {}), status: 'draft' },
        version: record.version,
      })
      setRecord(saved)
      setNodes(nodesOf(saved.orbatJson))
      setNote('')
    } catch (error) {
      push(error?.message || 'The playing ORBAT could not be re-opened.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const replicate = async () => {
    if (!side || !gameId) return
    setBusy(true)
    try {
      await api.replicatePlayingOrbat(gameId, side.id)
      const rows = await api.listPlayingOrbats(gameId)
      const match = (rows || []).find((item) => String(item.sideId) === String(side.id))
      if (match) {
        setRecord(match)
        setNodes(nodesOf(match.orbatJson))
        setNote('')
      }
    } catch (error) {
      push(error?.message || 'The playing ORBAT could not be created.', 'error')
    } finally {
      setBusy(false)
    }
  }

  const closeMenu = () => useOrbatPicture.getState().closeMenu()
  const byId = useMemo(() => new Map(nodes.map((node) => [node.id, node])), [nodes])
  const hitId = menu?.nodeIds?.length === 1 ? menu.nodeIds[0] : null
  const hit = hitId ? byId.get(hitId) : null
  const typeOf = (node) => types.find((item) => String(item.id) === String(node?.nodeTypeId)) || null
  const typeName = (node) => typeOf(node)?.name || 'Node'
  const openAir = (node) => {
    closeMenu()
    setAirNode(node)
  }
  const label = mode === 'playing'
    ? `Playing${gameName ? ` · ${gameName}` : ''}${side ? ` · ${side.name}` : ''}`
    : `Standard${side ? ` · ${side.name}` : ''}`

  const openAdd = (parentId) => {
    closeMenu()
    setDialog({
      kind: 'add',
      parent: parentId ? byId.get(parentId) : null,
      preset: menu ? {
        latitude: Math.round(menu.latitude * 1e5) / 1e5,
        longitude: Math.round(menu.longitude * 1e5) / 1e5,
      } : null,
    })
  }

  const openEdit = (id) => {
    closeMenu()
    setDialog({ kind: 'edit', node: byId.get(id) })
  }

  const saveDialog = async (values) => {
    const parentId = values.parentId || dialog?.parent?.id
    if (dialog?.kind === 'edit') {
      const { parentId: nextParent, ...patch } = values
      let next = updateNode(nodes, dialog.node.id, patch)
      if (nextParent && nextParent !== dialog.node.parentId) next = updateNode(next, dialog.node.id, { parentId: nextParent })
      await persist(next)
    } else {
      const { parentId: chosen, ...fields } = values
      const result = addChild(nodes, chosen || parentId, { ...fields, homeSideId: side?.id })
      await persist(result.nodes)
    }
    setDialog(null)
  }

  useEffect(() => {
    if (!selectToken) return
    const id = useOrbatPicture.getState().selectedId
    const node = nodesRef.current.find((item) => item.id === id)
    const code = types.find((item) => String(item.id) === String(node?.nodeTypeId))?.code
    if (code === 'AIRBASE') setAirNode(node)
  }, [selectToken, types])

  if (!mode || suspended) return null

  const hoverNode = hover?.nodeIds?.length === 1 ? byId.get(hover.nodeIds[0]) : null

  return (
    <>
      <Paper
        elevation={0}
        sx={{
          position: 'absolute',
          top: 12,
          left: 12,
          zIndex: 3,
          px: 1.25,
          py: 0.75,
          display: 'flex',
          alignItems: 'center',
          gap: 1,
          maxWidth: 'calc(100% - 80px)',
        }}
      >
        <Typography variant="body2" sx={{ fontWeight: 650 }}>{mode === 'playing' ? 'Playing' : 'Standard'}</Typography>
        <SearchSelect
          size="small"
          hiddenLabel
          aria-label="Side"
          fullWidth={false}
          disableClearable
          disabled={!administrator}
          options={administrator ? sides : sides.filter((item) => String(item.id) === ownSideId)}
          value={sideId}
          onChange={(id) => {
            if (!administrator && String(id) !== ownSideId) return
            setAirNode(null)
            setSideId(String(id))
          }}
          getOptionLabel={(item) => item.name}
          getOptionValue={(item) => String(item.id)}
          sx={{ minWidth: 140, width: 160 }}
        />
        {mode === 'playing' && gameName ? <Typography variant="caption" color="text.secondary">{gameName}</Typography> : null}
        {note ? <Typography variant="caption" color="text.secondary">{note}</Typography> : null}
        {finalized ? <Button size="small" disabled={busy} onClick={reopen}>Re-edit</Button> : null}
        {mode === 'playing' && !record && gameId && side ? <Button size="small" disabled={busy} onClick={replicate}>Add this side</Button> : null}
      </Paper>
      {hoverNode ? (
        <Box sx={{ position: 'fixed', left: hover.x + 14, top: hover.y + 14, zIndex: 4, px: 1, py: 0.5, bgcolor: 'background.paper', border: 1, borderColor: 'divider', pointerEvents: 'none' }}>
          <Typography variant="caption">{mode === 'playing' ? 'Playing' : 'Standard'} · {hoverNode.name}</Typography>
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{typeName(hoverNode)}{typeOf(hoverNode)?.code === 'AIRBASE' ? ' · click to allot' : ''}</Typography>
        </Box>
      ) : null}
      <Menu
        open={Boolean(menu) && !dialog}
        onClose={closeMenu}
        anchorReference="anchorPosition"
        anchorPosition={menu ? { top: menu.y, left: menu.x } : undefined}
      >
        <MenuItem disabled>{hit ? `${label} · ${hit.name}` : label}</MenuItem>
        {editable && menu?.nodeIds?.length > 1 ? menu.nodeIds.map((id) => {
          const node = byId.get(id)
          if (!node) return null
          return <MenuItem key={id} onClick={() => openAdd(id)}>Add under {node.name}</MenuItem>
        }) : null}
        {editable && hit ? <MenuItem onClick={() => openAdd(hit.id)}>Add under this</MenuItem> : null}
        {editable && hit?.parentId ? <MenuItem onClick={() => openEdit(hit.id)}>Edit</MenuItem> : null}
        {hit && typeOf(hit)?.code === 'AIRBASE' ? <MenuItem onClick={() => openAir(hit)}>Air data</MenuItem> : null}
        {editable && !hit ? <MenuItem onClick={() => openAdd(null)}>Add here</MenuItem> : null}
        {!editable ? <MenuItem disabled>{finalized ? 'Re-edit before changing this' : 'Read only'}</MenuItem> : null}
      </Menu>
      {airNode && side ? (
        <AirMapCard
          mode={mode}
          side={side}
          gameId={gameId}
          gameName={gameName}
          node={airNode}
          onClose={() => setAirNode(null)}
        />
      ) : null}
      <NodeFormDialog
        open={Boolean(dialog)}
        title={dialog?.kind === 'edit' ? `Edit in ${mode === 'playing' ? 'Playing' : 'Standard'}` : `Add to ${mode === 'playing' ? 'Playing' : 'Standard'}`}
        types={types}
        hierarchy={nodes}
        parent={dialog?.parent || null}
        initial={dialog?.kind === 'edit' ? dialog.node : null}
        preset={dialog?.preset}
        iconTheme={iconTheme}
        sides={administrator ? sides : null}
        sideId={sideId}
        onSideChange={(id) => setSideId(String(id))}
        onClose={() => setDialog(null)}
        onSubmit={saveDialog}
      />
    </>
  )
}
