import { useEffect, useState } from 'react'
import { Box, IconButton, Paper, Stack, Typography } from '@mui/material'
import CloseIcon from '@mui/icons-material/Close'
import { useToastStore } from '../feedback/useToastStore'
import {
  airSnapshot,
  gameView,
  listLoadTypes,
  listPlatformTypes,
  setBaseLimit,
  setGameBaseLoad,
  setGameIssue,
  setGameLoad,
  setGamePlatform,
  setIssue,
  setLoadAllotment,
  setPlatformAllotment,
  sideView,
} from './api'
import { gameCarry, issueRoom, loadRoom, platformRoom } from './model'

function Qty({ value, label, helper, onCommit }) {
  const push = useToastStore((state) => state.push)
  const [text, setText] = useState(String(value ?? 0))
  useEffect(() => setText(String(value ?? 0)), [value])
  const commit = () => {
    const number = text === '' ? 0 : Number(text)
    if (number === Number(value ?? 0)) return
    try {
      onCommit(number)
    } catch (error) {
      push(error?.message || 'That quantity was refused.', 'error')
      setText(String(value ?? 0))
    }
  }
  return (
    <Box
      component="label"
      sx={{ display: 'grid', gridTemplateColumns: '1fr 5.5rem', gap: 1, alignItems: 'center' }}
    >
      <Box sx={{ minWidth: 0 }}>
        <Typography variant="body2">{label}</Typography>
        {helper ? <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>{helper}</Typography> : null}
      </Box>
      <Box
        component="input"
        type="number"
        min="0"
        step="1"
        value={text}
        onChange={(event) => setText(event.target.value)}
        onBlur={commit}
        onKeyDown={(event) => { if (event.key === 'Enter') event.currentTarget.blur() }}
        sx={{ width: '100%', px: 1, py: 0.75, border: 1, borderColor: 'divider', borderRadius: 1, bgcolor: 'background.paper', color: 'text.primary' }}
      />
    </Box>
  )
}

/** Allotment for the airbase under the pointer. Standard edits the side. Playing edits only this game. */
export function AirMapCard({ mode, side, gameId, gameName, node, onClose }) {
  const [rev, setRev] = useState(0)
  const reload = () => setRev((value) => value + 1)
  const book = airSnapshot()
  const platforms = listPlatformTypes()
  const loads = listLoadTypes()
  const view = sideView(side.id)
  const nodeId = node.sourceNodeId || node.id
  const game = mode === 'playing' && gameId ? gameView(gameId, side.id) : null
  const standardAircraft = (id) => view.platformAllotments.find((row) => row.standardNodeId === nodeId && row.platformTypeId === id)?.quantity || 0
  const standardStock = (id) => view.loadAllotments.find((row) => row.standardNodeId === nodeId && row.loadTypeId === id)?.quantity || 0
  const standardIssue = (platformId, loadId) => view.loadIssues.find((row) => row.standardNodeId === nodeId && row.platformTypeId === platformId && row.loadTypeId === loadId)?.quantity || 0
  const gameAircraft = (id) => game?.platforms.find((row) => row.standardNodeId === nodeId && row.platformTypeId === id)?.quantity || 0
  const gameStock = (id) => game?.loads.find((row) => row.standardNodeId === nodeId && row.loadTypeId === id)?.quantity || 0
  const gameIssue = (platformId, loadId) => game?.issues.find((row) => row.standardNodeId === nodeId && row.platformTypeId === platformId && row.loadTypeId === loadId)?.quantity || 0
  const limit = (id) => view.baseLimits.find((row) => row.standardNodeId === nodeId && row.platformTypeId === id)?.maxCount || 0

  return (
    <Paper
      elevation={6}
      sx={{
        position: 'absolute',
        top: 56,
        right: 12,
        bottom: 12,
        width: { xs: 'min(100% - 24px, 22rem)', sm: '22rem' },
        zIndex: 4,
        display: 'flex',
        flexDirection: 'column',
        overflow: 'hidden',
      }}
    >
      <Stack direction="row" sx={{ alignItems: 'flex-start', px: 1.5, py: 1, borderBottom: 1, borderColor: 'divider' }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="overline" color="text.secondary">{mode === 'playing' ? `Playing${gameName ? ` · ${gameName}` : ''}` : 'Standard'}</Typography>
          <Typography variant="subtitle1">{node.name}</Typography>
          <Typography variant="caption" color="text.secondary">{side.name} · airbase in the standard ORBAT</Typography>
        </Box>
        <IconButton size="small" aria-label="Close" onClick={onClose}><CloseIcon fontSize="small" /></IconButton>
      </Stack>
      <Box sx={{ flex: 1, overflow: 'auto', px: 1.5, py: 1.5 }}>
        {mode === 'playing' && !gameId ? <Typography variant="body2">Choose an active game before changing what this base takes into play.</Typography> : null}
        {mode === 'standard' ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">These figures belong to the side. A game can take less, and can fit fewer weapons, but it cannot pass them.</Typography>
            <Typography variant="subtitle2">Base limit</Typography>
            {platforms.map((platform) => (
              <Qty key={platform.id} label={`${platform.name} maximum`} value={limit(platform.id)} onCommit={(quantity) => { setBaseLimit(side.id, nodeId, platform.id, quantity); reload() }} />
            ))}
            <Typography variant="subtitle2">Aircraft from the pool</Typography>
            {platforms.map((platform) => {
              const room = platformRoom(book, side.id, nodeId, platform.id)
              return (
                <Qty
                  key={platform.id}
                  label={platform.name}
                  value={standardAircraft(platform.id)}
                  helper={room.configured ? `Pool ${room.owned}. Other bases ${room.elsewhere}. Limit ${room.baseMax}.` : 'Set a maximum first.'}
                  onCommit={(quantity) => { setPlatformAllotment(side.id, nodeId, platform.id, quantity); reload() }}
                />
              )
            })}
            <Typography variant="subtitle2">Weapon stock</Typography>
            {loads.map((load) => {
              const room = loadRoom(book, side.id, nodeId, load.id)
              return (
                <Qty key={load.id} label={load.name} value={standardStock(load.id)} helper={`Pool ${room.owned}. Other stocks ${room.elsewhere}.`} onCommit={(quantity) => { setLoadAllotment(side.id, nodeId, load.id, quantity); reload() }} />
              )
            })}
            <Typography variant="subtitle2">Issued onto aircraft here</Typography>
            {platforms.filter((platform) => standardAircraft(platform.id) > 0).map((platform) => (
              <Stack key={platform.id} spacing={1}>
                <Typography variant="body2">{platform.name} × {standardAircraft(platform.id)}</Typography>
                {loads.map((load) => {
                  const room = issueRoom(book, side.id, nodeId, platform.id, load.id)
                  if (!room.allowed) return null
                  return (
                    <Qty
                      key={load.id}
                      label={load.name}
                      value={standardIssue(platform.id, load.id)}
                      helper={`${room.perPlatform} each, ${room.capacity} in total.`}
                      onCommit={(quantity) => { setIssue(side.id, nodeId, platform.id, load.id, quantity); reload() }}
                    />
                  )
                })}
              </Stack>
            ))}
          </Stack>
        ) : null}
        {mode === 'playing' && gameId ? (
          <Stack spacing={2}>
            <Typography variant="body2" color="text.secondary">This game only. Another game can take a different number and a different fit. Nothing here can pass the standard figures.</Typography>
            <Typography variant="subtitle2">Aircraft in this game</Typography>
            {platforms.map((platform) => {
              const ceiling = standardAircraft(platform.id)
              if (!ceiling) return null
              return (
                <Qty
                  key={platform.id}
                  label={platform.name}
                  value={gameAircraft(platform.id)}
                  helper={`Standard allotment ${ceiling}.`}
                  onCommit={(quantity) => { setGamePlatform(gameId, side.id, nodeId, platform.id, quantity); reload() }}
                />
              )
            })}
            {!platforms.some((platform) => standardAircraft(platform.id) > 0) ? <Typography variant="caption" color="text.secondary">Allot aircraft on the standard copy of this base first.</Typography> : null}
            <Typography variant="subtitle2">Stock in this game</Typography>
            {loads.map((load) => {
              const ceiling = standardStock(load.id)
              if (!ceiling) return null
              return (
                <Qty key={load.id} label={load.name} value={gameStock(load.id)} helper={`Standard stock ${ceiling}.`} onCommit={(quantity) => { setGameLoad(gameId, side.id, nodeId, load.id, quantity); reload() }} />
              )
            })}
            <Typography variant="subtitle2">Fit and issue in this game</Typography>
            {platforms.filter((platform) => gameAircraft(platform.id) > 0 || standardAircraft(platform.id) > 0).map((platform) => (
              <Stack key={platform.id} spacing={1}>
                <Typography variant="body2">{platform.name}</Typography>
                {loads.map((load) => {
                  const carry = gameCarry(book, gameId, side.id, nodeId, platform.id, load.id)
                  if (!carry) return null
                  return (
                    <Stack key={load.id} spacing={0.75}>
                      <Qty
                        label={`${load.name} per aircraft`}
                        value={carry.max}
                        helper={`Standard fit ${carry.standardMax}.`}
                        onCommit={(quantity) => { setGameBaseLoad(gameId, side.id, nodeId, platform.id, load.id, quantity); reload() }}
                      />
                      <Qty
                        label={`${load.name} issued`}
                        value={gameIssue(platform.id, load.id)}
                        helper={`Standard issue ${standardIssue(platform.id, load.id)}. This game’s aircraft can carry ${gameAircraft(platform.id) * carry.max}.`}
                        onCommit={(quantity) => { setGameIssue(gameId, side.id, nodeId, platform.id, load.id, quantity); reload() }}
                      />
                    </Stack>
                  )
                })}
              </Stack>
            ))}
          </Stack>
        ) : null}
      </Box>
    </Paper>
  )
}
