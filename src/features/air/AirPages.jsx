import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import {
  Alert,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from '@mui/material'
import AddIcon from '@mui/icons-material/Add'
import { get } from '../../shared/api/http'
import { SearchSelect } from '../../shared/ui/SearchSelect'
import { LoadingState } from '../../shared/ui/LoadingState'
import { ExerciseLayout } from '../scenario/ExerciseLayout'
import { useToastStore } from '../feedback/useToastStore'
import { useSessionStore } from '../session/useSessionStore'
import { loadAirbases } from './airbases'
import {
  airSnapshot,
  deleteLoadType,
  deletePlatformType,
  fillExampleLimits,
  fillExamplePool,
  gameView,
  listLoadTypes,
  listPlatformLoads,
  listPlatformTypes,
  saveLoadType,
  savePlatformType,
  setBaseLimit,
  setGameIssue,
  setGameLoad,
  setGamePlatform,
  setIssue,
  setLoadAllotment,
  setLoadHolding,
  setPlatformAllotment,
  setPlatformHolding,
  sideView,
} from './api'
import { issueRoom, loadRoom, platformRoom } from './model'

const ROLES = [
  { id: 'fighter', name: 'Fighter' },
  { id: 'transport', name: 'Transport' },
  { id: 'helicopter', name: 'Helicopter' },
  { id: 'uav', name: 'UAV' },
  { id: 'reconnaissance', name: 'Reconnaissance' },
]

const CATEGORIES = [
  { id: 'missile', name: 'Missile' },
  { id: 'bomb', name: 'Bomb' },
  { id: 'gun', name: 'Gun' },
  { id: 'rocket', name: 'Rocket' },
  { id: 'other', name: 'Other' },
]

function useBook() {
  const [rev, setRev] = useState(0)
  const reload = () => setRev((value) => value + 1)
  const book = useMemo(() => airSnapshot(), [rev])
  return { book, reload }
}

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
    <TextField
      size="small"
      type="number"
      label={label}
      value={text}
      helperText={helper}
      onChange={(event) => setText(event.target.value)}
      onBlur={commit}
      onKeyDown={(event) => { if (event.key === 'Enter') commit() }}
      slotProps={{ htmlInput: { min: 0, step: 1 } }}
    />
  )
}

function nameOf(rows, id) {
  return rows.find((row) => row.id === id)?.name || 'Unknown'
}

function TypesTab({ reload }) {
  const push = useToastStore((state) => state.push)
  const loads = listLoadTypes()
  const platforms = listPlatformTypes()
  const carries = listPlatformLoads()
  const [weapon, setWeapon] = useState(null)
  const [aircraft, setAircraft] = useState(null)

  const saveWeapon = () => {
    try {
      saveLoadType(weapon)
      setWeapon(null)
      reload()
    } catch (error) {
      push(error.message, 'error')
    }
  }

  const saveAircraft = () => {
    try {
      savePlatformType(aircraft, aircraft.loads || [])
      setAircraft(null)
      reload()
    } catch (error) {
      push(error.message, 'error')
    }
  }

  return (
    <Stack spacing={3}>
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">Weapons</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setWeapon({ code: '', name: '', category: 'missile', description: '' })}>Weapon</Button>
        </Stack>
        {!loads.length ? <Typography variant="body2" color="text.secondary">No weapons yet.</Typography> : null}
        {loads.map((load) => (
          <Box key={load.id} sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
            <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
              <Typography sx={{ flex: 1 }}>{load.name}</Typography>
              <Chip size="small" label={load.code} />
              <Chip size="small" variant="outlined" label={load.category} />
              <Button size="small" onClick={() => setWeapon(load)}>Edit</Button>
              <Button size="small" color="error" onClick={() => { try { deleteLoadType(load.id); reload() } catch (error) { push(error.message, 'error') } }}>Delete</Button>
            </Stack>
            <Typography variant="caption" color="text.secondary">
              {[load.guidance, load.rangeKm != null ? `${load.rangeKm} km` : '', load.warheadKg != null ? `${load.warheadKg} kg warhead` : '', load.weightKg != null ? `${load.weightKg} kg` : '', load.lengthM != null ? `${load.lengthM} m` : '', load.status === 'in_service' ? 'In service' : load.status].filter(Boolean).join(' · ')}
            </Typography>
          </Box>
        ))}
      </Stack>
      <Stack spacing={1}>
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Typography variant="subtitle1">Aircraft</Typography>
          <Button size="small" startIcon={<AddIcon />} onClick={() => setAircraft({ code: '', name: '', role: 'fighter', description: '', loads: [] })}>Aircraft</Button>
        </Stack>
        <Typography variant="body2" color="text.secondary">Every aircraft of a type shares that type’s weapon limits.</Typography>
        {platforms.map((platform) => {
          const own = carries.filter((row) => row.platformTypeId === platform.id)
          return (
            <Box key={platform.id} sx={{ py: 1, borderTop: 1, borderColor: 'divider' }}>
              <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                <Typography sx={{ flex: 1 }}>{platform.name}</Typography>
                <Chip size="small" label={platform.code} />
                <Chip size="small" variant="outlined" label={platform.role} />
                <Button size="small" onClick={() => setAircraft({ ...platform, loads: own.map((row) => ({ loadTypeId: row.loadTypeId, maxPerPlatform: row.maxPerPlatform })) })}>Edit</Button>
                <Button size="small" color="error" onClick={() => { try { deletePlatformType(platform.id); reload() } catch (error) { push(error.message, 'error') } }}>Delete</Button>
              </Stack>
              <Typography variant="caption" color="text.secondary">
                {[platform.manufacturer, platform.crew != null ? `crew ${platform.crew}` : '', platform.maxSpeedKmh != null ? `${platform.maxSpeedKmh} km/h` : '', platform.combatRadiusKm != null ? `radius ${platform.combatRadiusKm} km` : '', platform.ceilingM != null ? `ceiling ${platform.ceilingM} m` : '', platform.hardpoints != null ? `${platform.hardpoints} hardpoints` : '', platform.inServiceYear].filter(Boolean).join(' · ')}
              </Typography>
              <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                {own.length
                  ? own.map((row) => `${nameOf(loads, row.loadTypeId)} × ${row.maxPerPlatform}`).join(', ')
                  : 'Carries no weapons.'}
              </Typography>
            </Box>
          )
        })}
      </Stack>
      <Dialog open={Boolean(weapon)} onClose={() => setWeapon(null)} fullWidth maxWidth="xs">
        <DialogTitle>{weapon?.id ? 'Edit weapon' : 'New weapon'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField size="small" label="Name" value={weapon?.name || ''} onChange={(event) => setWeapon({ ...weapon, name: event.target.value })} />
            <TextField size="small" label="Code" value={weapon?.code || ''} onChange={(event) => setWeapon({ ...weapon, code: event.target.value })} />
            <SearchSelect label="Category" options={CATEGORIES} value={weapon?.category || 'missile'} onChange={(id) => setWeapon({ ...weapon, category: id })} getOptionLabel={(item) => item.name} getOptionValue={(item) => item.id} />
            <TextField size="small" label="Guidance" value={weapon?.guidance || ''} onChange={(event) => setWeapon({ ...weapon, guidance: event.target.value })} />
            <TextField size="small" type="number" label="Range (km)" value={weapon?.rangeKm ?? ''} onChange={(event) => setWeapon({ ...weapon, rangeKm: event.target.value })} />
            <TextField size="small" type="number" label="Warhead (kg)" value={weapon?.warheadKg ?? ''} onChange={(event) => setWeapon({ ...weapon, warheadKg: event.target.value })} />
            <TextField size="small" type="number" label="Weight (kg)" value={weapon?.weightKg ?? ''} onChange={(event) => setWeapon({ ...weapon, weightKg: event.target.value })} />
            <TextField size="small" type="number" label="Length (m)" value={weapon?.lengthM ?? ''} onChange={(event) => setWeapon({ ...weapon, lengthM: event.target.value })} />
            <TextField size="small" label="Description" value={weapon?.description || ''} onChange={(event) => setWeapon({ ...weapon, description: event.target.value })} />
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWeapon(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveWeapon}>Save</Button>
        </DialogActions>
      </Dialog>
      <Dialog open={Boolean(aircraft)} onClose={() => setAircraft(null)} fullWidth maxWidth="xs">
        <DialogTitle>{aircraft?.id ? 'Edit aircraft' : 'New aircraft'}</DialogTitle>
        <DialogContent>
          <Stack spacing={1.5} sx={{ pt: 1 }}>
            <TextField size="small" label="Name" value={aircraft?.name || ''} onChange={(event) => setAircraft({ ...aircraft, name: event.target.value })} />
            <TextField size="small" label="Code" value={aircraft?.code || ''} onChange={(event) => setAircraft({ ...aircraft, code: event.target.value })} />
            <SearchSelect label="Role" options={ROLES} value={aircraft?.role || 'fighter'} onChange={(id) => setAircraft({ ...aircraft, role: id })} getOptionLabel={(item) => item.name} getOptionValue={(item) => item.id} />
            <TextField size="small" label="Manufacturer" value={aircraft?.manufacturer || ''} onChange={(event) => setAircraft({ ...aircraft, manufacturer: event.target.value })} />
            <TextField size="small" type="number" label="Crew" value={aircraft?.crew ?? ''} onChange={(event) => setAircraft({ ...aircraft, crew: event.target.value })} />
            <TextField size="small" type="number" label="Maximum speed (km/h)" value={aircraft?.maxSpeedKmh ?? ''} onChange={(event) => setAircraft({ ...aircraft, maxSpeedKmh: event.target.value })} />
            <TextField size="small" type="number" label="Combat radius (km)" value={aircraft?.combatRadiusKm ?? ''} onChange={(event) => setAircraft({ ...aircraft, combatRadiusKm: event.target.value })} />
            <TextField size="small" type="number" label="Ceiling (m)" value={aircraft?.ceilingM ?? ''} onChange={(event) => setAircraft({ ...aircraft, ceilingM: event.target.value })} />
            <TextField size="small" type="number" label="Hardpoints" value={aircraft?.hardpoints ?? ''} onChange={(event) => setAircraft({ ...aircraft, hardpoints: event.target.value })} />
            <TextField size="small" type="number" label="In service from" value={aircraft?.inServiceYear ?? ''} onChange={(event) => setAircraft({ ...aircraft, inServiceYear: event.target.value })} />
            <TextField size="small" label="Description" value={aircraft?.description || ''} onChange={(event) => setAircraft({ ...aircraft, description: event.target.value })} />
            <Typography variant="caption" color="text.secondary">Weapon limits for one aircraft of this type.</Typography>
            {loads.map((load) => {
              const current = (aircraft?.loads || []).find((row) => row.loadTypeId === load.id)
              return (
                <TextField
                  key={load.id}
                  size="small"
                  type="number"
                  label={load.name}
                  value={current ? current.maxPerPlatform : ''}
                  placeholder="Cannot carry"
                  onChange={(event) => {
                    const max = event.target.value === '' ? null : Number(event.target.value)
                    const next = (aircraft.loads || []).filter((row) => row.loadTypeId !== load.id)
                    if (max) next.push({ loadTypeId: load.id, maxPerPlatform: max })
                    setAircraft({ ...aircraft, loads: next })
                  }}
                />
              )
            })}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setAircraft(null)}>Cancel</Button>
          <Button variant="contained" onClick={saveAircraft}>Save</Button>
        </DialogActions>
      </Dialog>
    </Stack>
  )
}

function HoldingTab({ sideId, reload }) {
  const push = useToastStore((state) => state.push)
  const platforms = listPlatformTypes()
  const loads = listLoadTypes()
  const view = sideView(sideId)
  const ownedPlatform = (id) => view.platformHoldings.find((row) => row.platformTypeId === id)?.quantity || 0
  const ownedLoad = (id) => view.loadHoldings.find((row) => row.loadTypeId === id)?.quantity || 0
  return (
    <Stack spacing={2}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary">This pool is spent by allotments. The sum placed on bases cannot pass it.</Typography>
        <Button size="small" onClick={() => { try { fillExamplePool(sideId); reload() } catch (error) { push(error.message, 'error') } }}>Fill the example pool</Button>
      </Stack>
      <Typography variant="subtitle2">Aircraft</Typography>
      {platforms.map((platform) => (
        <Qty
          key={platform.id}
          label={platform.name}
          value={ownedPlatform(platform.id)}
          onCommit={(quantity) => { setPlatformHolding(sideId, platform.id, quantity); reload() }}
        />
      ))}
      <Typography variant="subtitle2">Weapons</Typography>
      {loads.map((load) => (
        <Qty
          key={load.id}
          label={load.name}
          value={ownedLoad(load.id)}
          onCommit={(quantity) => { setLoadHolding(sideId, load.id, quantity); reload() }}
        />
      ))}
    </Stack>
  )
}

function BaseTab({ sideId, base, reload }) {
  const push = useToastStore((state) => state.push)
  const platforms = listPlatformTypes()
  const loads = listLoadTypes()
  const view = sideView(sideId)
  const book = airSnapshot()
  const limit = (id) => view.baseLimits.find((row) => row.standardNodeId === base.standardNodeId && row.platformTypeId === id)?.maxCount || 0
  const allotted = (id) => view.platformAllotments.find((row) => row.standardNodeId === base.standardNodeId && row.platformTypeId === id)?.quantity || 0
  const stock = (id) => view.loadAllotments.find((row) => row.standardNodeId === base.standardNodeId && row.loadTypeId === id)?.quantity || 0
  const issued = (platformId, loadId) => view.loadIssues.find((row) => row.standardNodeId === base.standardNodeId && row.platformTypeId === platformId && row.loadTypeId === loadId)?.quantity || 0
  const nodeId = base.standardNodeId
  return (
    <Stack spacing={2.5}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
        <Box>
          <Typography variant="subtitle1">{base.name}</Typography>
          <Typography variant="caption" color="text.secondary">Standard ORBAT node {nodeId}</Typography>
        </Box>
        <Button size="small" onClick={() => { try { fillExampleLimits(sideId, nodeId); reload() } catch (error) { push(error.message, 'error') } }}>Use the example limits</Button>
      </Stack>
      <Typography variant="subtitle2">What this base may hold</Typography>
      {platforms.map((platform) => (
        <Qty
          key={platform.id}
          label={`${platform.name} maximum`}
          value={limit(platform.id)}
          onCommit={(quantity) => { setBaseLimit(sideId, nodeId, platform.id, quantity); reload() }}
        />
      ))}
      <Typography variant="subtitle2">Aircraft from the side pool</Typography>
      {platforms.map((platform) => {
        const room = platformRoom(book, sideId, nodeId, platform.id)
        return (
          <Qty
            key={platform.id}
            label={platform.name}
            value={allotted(platform.id)}
            helper={room.configured ? `Side holds ${room.owned}, ${room.elsewhere} on other bases, this base allows ${room.baseMax}.` : 'Not configured for this base.'}
            onCommit={(quantity) => { setPlatformAllotment(sideId, nodeId, platform.id, quantity); reload() }}
          />
        )
      })}
      <Typography variant="subtitle2">Weapons in the base stock</Typography>
      {loads.map((load) => {
        const room = loadRoom(book, sideId, nodeId, load.id)
        return (
          <Qty
            key={load.id}
            label={load.name}
            value={stock(load.id)}
            helper={`Side holds ${room.owned}, ${room.elsewhere} in other stocks.`}
            onCommit={(quantity) => { setLoadAllotment(sideId, nodeId, load.id, quantity); reload() }}
          />
        )
      })}
      <Typography variant="subtitle2">Weapons issued from this stock onto aircraft here</Typography>
      {platforms.filter((platform) => allotted(platform.id) > 0).map((platform) => (
        <Stack key={platform.id} spacing={1}>
          <Typography variant="body2">{platform.name} × {allotted(platform.id)}</Typography>
          {loads.map((load) => {
            const room = issueRoom(book, sideId, nodeId, platform.id, load.id)
            if (!room.allowed) return null
            return (
              <Qty
                key={load.id}
                label={load.name}
                value={issued(platform.id, load.id)}
                helper={`Up to ${room.perPlatform} each, ${room.capacity} in total. Stock left for this weapon ${room.stockLeft}.`}
                onCommit={(quantity) => { setIssue(sideId, nodeId, platform.id, load.id, quantity); reload() }}
              />
            )
          })}
        </Stack>
      ))}
    </Stack>
  )
}

function GameTab({ sideId, bases, games, reload }) {
  const [gameId, setGameId] = useState(games.find((game) => game.active)?.id || games[0]?.id || '')
  const platforms = listPlatformTypes()
  const loads = listLoadTypes()
  const view = sideView(sideId)
  const game = gameId ? gameView(gameId, sideId) : { platforms: [], loads: [], issues: [] }
  const book = airSnapshot()
  if (!games.length) return <Typography variant="body2" color="text.secondary">There is no game to draw from this standard setup.</Typography>
  const takenPlatform = (nodeId, typeId) => game.platforms.find((row) => row.standardNodeId === nodeId && row.platformTypeId === typeId)?.quantity || 0
  const takenLoad = (nodeId, typeId) => game.loads.find((row) => row.standardNodeId === nodeId && row.loadTypeId === typeId)?.quantity || 0
  const takenIssue = (nodeId, platformId, loadId) => game.issues.find((row) => row.standardNodeId === nodeId && row.platformTypeId === platformId && row.loadTypeId === loadId)?.quantity || 0
  return (
    <Stack spacing={2}>
      <SearchSelect
        label="Game"
        options={games}
        value={gameId}
        onChange={setGameId}
        getOptionLabel={(item) => item.name}
        getOptionValue={(item) => String(item.id)}
      />
      <Typography variant="body2" color="text.secondary">The game can take only part of the standard allotment. It cannot add a type or a quantity the side did not already place.</Typography>
      {!bases.length ? <Typography variant="body2" color="text.secondary">Allot aircraft to an airbase before choosing what enters the game.</Typography> : null}
      {bases.map((base) => (
        <Stack key={base.standardNodeId} spacing={1.25} sx={{ pt: 1, borderTop: 1, borderColor: 'divider' }}>
          <Typography variant="subtitle2">{base.name}</Typography>
          {platforms.map((platform) => {
            const standard = view.platformAllotments.find((row) => row.standardNodeId === base.standardNodeId && row.platformTypeId === platform.id)?.quantity || 0
            if (!standard) return null
            return (
              <Qty
                key={platform.id}
                label={`${platform.name} in the game`}
                value={takenPlatform(base.standardNodeId, platform.id)}
                helper={`Standard allotment ${standard}.`}
                onCommit={(quantity) => { setGamePlatform(gameId, sideId, base.standardNodeId, platform.id, quantity); reload() }}
              />
            )
          })}
          {loads.map((load) => {
            const standard = view.loadAllotments.find((row) => row.standardNodeId === base.standardNodeId && row.loadTypeId === load.id)?.quantity || 0
            if (!standard) return null
            return (
              <Qty
                key={load.id}
                label={`${load.name} stock in the game`}
                value={takenLoad(base.standardNodeId, load.id)}
                helper={`Standard stock ${standard}.`}
                onCommit={(quantity) => { setGameLoad(gameId, sideId, base.standardNodeId, load.id, quantity); reload() }}
              />
            )
          })}
          {platforms.map((platform) => loads.map((load) => {
            const standard = view.loadIssues.find((row) => row.standardNodeId === base.standardNodeId && row.platformTypeId === platform.id && row.loadTypeId === load.id)?.quantity || 0
            if (!standard) return null
            const room = issueRoom(book, sideId, base.standardNodeId, platform.id, load.id)
            return (
              <Qty
                key={`${platform.id}-${load.id}`}
                label={`${load.name} on ${platform.name}`}
                value={takenIssue(base.standardNodeId, platform.id, load.id)}
                helper={`Standard issue ${standard}. Aircraft in the game can carry ${room.perPlatform} each.`}
                onCommit={(quantity) => { setGameIssue(gameId, sideId, base.standardNodeId, platform.id, load.id, quantity); reload() }}
              />
            )
          }))}
        </Stack>
      ))}
    </Stack>
  )
}

export function AirPage() {
  const session = useSessionStore((state) => state.session)
  const push = useToastStore((state) => state.push)
  const [params] = useSearchParams()
  const { reload } = useBook()
  const [tab, setTab] = useState(params.get('base') ? 'bases' : 'types')
  const [sides, setSides] = useState(null)
  const [sideId, setSideId] = useState(params.get('side') || '')
  const [bases, setBases] = useState([])
  const [baseId, setBaseId] = useState(params.get('base') || '')
  const [basesNote, setBasesNote] = useState('')
  const apex = session?.me?.name === 'APEX'
  const ownSide = session?.me?.administeredSideId

  useEffect(() => {
    let live = true
    get('/sides')
      .then((rows) => {
        if (!live) return
        setSides(rows || [])
        const initial = params.get('side') || (!apex && ownSide ? String(ownSide) : '')
        const found = (rows || []).find((side) => String(side.id) === String(initial)) || (apex ? (rows || [])[0] : (rows || []).find((side) => String(side.id) === String(ownSide)))
        if (found) setSideId(String(found.id))
      })
      .catch((error) => {
        if (!live) return
        setSides([])
        push(error?.message || 'Sides could not be loaded.', 'error')
      })
    return () => { live = false }
  }, [apex, ownSide, params, push])

  useEffect(() => {
    if (!sideId) return undefined
    let live = true
    setBasesNote('')
    loadAirbases(sideId)
      .then((rows) => {
        if (!live) return
        setBases(rows)
        const wanted = params.get('base')
        const found = rows.find((base) => base.standardNodeId === wanted) || rows[0]
        if (found) setBaseId(found.standardNodeId)
      })
      .catch((error) => {
        if (!live) return
        setBases([])
        setBasesNote(error?.message || 'Airbases could not be read from the standard ORBAT.')
      })
    return () => { live = false }
  }, [sideId, params])

  if (!sides) return <LoadingState label="Opening air data" />
  const side = sides.find((item) => String(item.id) === String(sideId)) || null
  const base = bases.find((item) => item.standardNodeId === baseId) || null
  const games = session?.games || []

  return (
    <ExerciseLayout
      kicker="Standard Data"
      title="Air"
      actions={apex ? (
        <SearchSelect
          label="Side"
          options={sides}
          value={sideId}
          onChange={(id) => setSideId(String(id))}
          getOptionLabel={(item) => item.name}
          getOptionValue={(item) => String(item.id)}
          sx={{ minWidth: 180 }}
        />
      ) : (
        <Typography variant="body2">{side ? side.name : 'No side'}</Typography>
      )}
    >
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        The side owns the aircraft and the weapons. Click an airbase on the map, with Standard or Playing selected, to allot it. Standard is the ceiling. Each game keeps its own quantities and its own weapon fit, and neither can pass that ceiling.
      </Typography>
      {!side ? <Alert severity="warning">This account has no side, so it cannot hold air data.</Alert> : (
        <>
          <Tabs value={tab} onChange={(_, value) => setTab(value)} sx={{ mb: 2 }}>
            <Tab value="types" label="Types" />
            <Tab value="holding" label="Holding" />
            <Tab value="bases" label="Airbases" />
            <Tab value="game" label="Game" />
          </Tabs>
          {tab === 'types' ? <TypesTab reload={reload} /> : null}
          {tab === 'holding' ? <HoldingTab sideId={side.id} reload={reload} /> : null}
          {tab === 'bases' ? (
            <Stack spacing={2}>
              {basesNote ? <Alert severity="error">{basesNote}</Alert> : null}
              {!bases.length ? (
                <Alert severity="info">An airbase is an Airbase node in this side’s standard ORBAT. Add one on the map with the Standard tool, then open it here or with Air data on a right-click.</Alert>
              ) : (
                <SearchSelect
                  label="Airbase"
                  options={bases}
                  value={baseId}
                  onChange={setBaseId}
                  getOptionLabel={(item) => item.name}
                  getOptionValue={(item) => item.standardNodeId}
                />
              )}
              {base ? <BaseTab sideId={side.id} base={base} reload={reload} /> : null}
            </Stack>
          ) : null}
          {tab === 'game' ? <GameTab sideId={side.id} bases={bases} games={games} reload={reload} /> : null}
        </>
      )}
    </ExerciseLayout>
  )
}
