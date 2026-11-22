import { ApiError } from '../../shared/api/errors'
import {
  AIR,
  AIR_EXAMPLE,
  assertGameBaseLoad,
  assertGameIssue,
  assertGameLoad,
  assertGamePlatform,
  assertIssue,
  assertLoadAllotment,
  assertLoadHolding,
  assertPlatformAllotment,
  assertPlatformHolding,
  emptyBook,
  putRow,
  stamp,
  uid,
} from './model'

const KEY = 'gis-warplan.air-standard.v1'

function numberOrNull(value) {
  if (value === '' || value == null) return null
  const number = Number(value)
  return Number.isFinite(number) ? number : null
}

function read() {
  try {
    const raw = localStorage.getItem(KEY)
    const book = raw ? { ...emptyBook(), ...JSON.parse(raw) } : seed()
    return enrich(book)
  } catch {
    return seed()
  }
}

function enrich(book) {
  if (!book.gameBaseLoads) book.gameBaseLoads = []
  AIR_EXAMPLE.loads.forEach((sample) => {
    const row = book.loadTypes.find((item) => item.code === sample.code)
    if (!row) return
    if (row.guidance == null) Object.assign(row, sample)
  })
  AIR_EXAMPLE.platforms.forEach((sample) => {
    const row = book.platformTypes.find((item) => item.code === sample.code)
    if (!row) return
    if (row.manufacturer == null) {
      const { loads, ...fields } = sample
      Object.assign(row, fields)
    }
  })
  return book
}

function write(book) {
  localStorage.setItem(KEY, JSON.stringify(book))
  return book
}

function fail(error) {
  throw new ApiError(error?.message || 'The air data could not be saved.', error?.code || 'CONFLICT')
}

function seed() {
  const book = emptyBook()
  const loads = {}
  AIR_EXAMPLE.loads.forEach((load) => {
    const row = stamp({
      id: uid('load'),
      domain: AIR,
      code: load.code,
      name: load.name,
      category: load.category,
      guidance: load.guidance,
      rangeKm: load.rangeKm,
      warheadKg: load.warheadKg,
      weightKg: load.weightKg,
      lengthM: load.lengthM,
      status: load.status,
      description: load.description,
    })
    book.loadTypes.push(row)
    loads[load.code] = row.id
  })
  AIR_EXAMPLE.platforms.forEach((platform) => {
    const row = stamp({
      id: uid('platform'),
      domain: AIR,
      code: platform.code,
      name: platform.name,
      role: platform.role,
      manufacturer: platform.manufacturer,
      crew: platform.crew,
      maxSpeedKmh: platform.maxSpeedKmh,
      combatRadiusKm: platform.combatRadiusKm,
      ceilingM: platform.ceilingM,
      hardpoints: platform.hardpoints,
      inServiceYear: platform.inServiceYear,
      description: platform.description,
    })
    book.platformTypes.push(row)
    platform.loads.forEach((load) => {
      book.platformLoads.push(stamp({
        id: uid('carry'),
        domain: AIR,
        platformTypeId: row.id,
        loadTypeId: loads[load.code],
        maxPerPlatform: load.maxPerPlatform,
      }))
    })
  })
  write(book)
  return book
}

function mutate(change) {
  const book = read()
  try {
    change(book)
  } catch (error) {
    fail(error)
  }
  write(book)
  return book
}

function platformKey(row) {
  return `${row.sideId}:${row.platformTypeId}`
}

function loadKey(row) {
  return `${row.sideId}:${row.loadTypeId}`
}

function limitKey(row) {
  return `${row.sideId}:${row.standardNodeId}:${row.platformTypeId}`
}

function platformAtBase(row) {
  return `${row.sideId}:${row.standardNodeId}:${row.platformTypeId}`
}

function loadAtBase(row) {
  return `${row.sideId}:${row.standardNodeId}:${row.loadTypeId}`
}

function issueKey(row) {
  return `${row.sideId}:${row.standardNodeId}:${row.platformTypeId}:${row.loadTypeId}`
}

function gamePlatformKey(row) {
  return `${row.gameId}:${row.sideId}:${row.standardNodeId}:${row.platformTypeId}`
}

function gameLoadKey(row) {
  return `${row.gameId}:${row.sideId}:${row.standardNodeId}:${row.loadTypeId}`
}

function gameIssueKey(row) {
  return `${row.gameId}:${row.sideId}:${row.standardNodeId}:${row.platformTypeId}:${row.loadTypeId}`
}

export function airSnapshot() {
  return read()
}

export function listPlatformTypes() {
  return read().platformTypes.filter((row) => row.domain === AIR)
}

export function listLoadTypes() {
  return read().loadTypes.filter((row) => row.domain === AIR)
}

export function listPlatformLoads() {
  return read().platformLoads.filter((row) => row.domain === AIR)
}

export function saveLoadType(draft) {
  const name = String(draft.name || '').trim()
  const code = String(draft.code || '').trim().toUpperCase()
  if (!name || !code) fail(new Error('A weapon needs a name and a code.'))
  return mutate((book) => {
    if (book.loadTypes.some((row) => row.domain === AIR && row.code === code && row.id !== draft.id)) {
      fail(new Error('That weapon code is already used.'))
    }
    const row = stamp({
      id: draft.id || uid('load'),
      domain: AIR,
      code,
      name,
      category: draft.category || 'missile',
      guidance: String(draft.guidance || '').trim(),
      rangeKm: numberOrNull(draft.rangeKm),
      warheadKg: numberOrNull(draft.warheadKg),
      weightKg: numberOrNull(draft.weightKg),
      lengthM: numberOrNull(draft.lengthM),
      status: draft.status || 'in_service',
      description: String(draft.description || '').trim(),
    })
    const index = book.loadTypes.findIndex((item) => item.id === row.id)
    if (index >= 0) book.loadTypes[index] = { ...book.loadTypes[index], ...row, createdAt: book.loadTypes[index].createdAt }
    else book.loadTypes.push(row)
  })
}

export function deleteLoadType(id) {
  return mutate((book) => {
    const used = book.platformLoads.some((row) => row.loadTypeId === id)
      || book.loadHoldings.some((row) => row.loadTypeId === id)
      || book.loadAllotments.some((row) => row.loadTypeId === id)
    if (used) fail(new Error('This weapon is already in a configuration or a holding.'))
    book.loadTypes = book.loadTypes.filter((row) => row.id !== id)
  })
}

export function savePlatformType(draft, loads) {
  const name = String(draft.name || '').trim()
  const code = String(draft.code || '').trim().toUpperCase()
  if (!name || !code) fail(new Error('An aircraft needs a name and a code.'))
  return mutate((book) => {
    if (book.platformTypes.some((row) => row.domain === AIR && row.code === code && row.id !== draft.id)) {
      fail(new Error('That aircraft code is already used.'))
    }
    const row = stamp({
      id: draft.id || uid('platform'),
      domain: AIR,
      code,
      name,
      role: draft.role || 'fighter',
      manufacturer: String(draft.manufacturer || '').trim(),
      crew: numberOrNull(draft.crew),
      maxSpeedKmh: numberOrNull(draft.maxSpeedKmh),
      combatRadiusKm: numberOrNull(draft.combatRadiusKm),
      ceilingM: numberOrNull(draft.ceilingM),
      hardpoints: numberOrNull(draft.hardpoints),
      inServiceYear: numberOrNull(draft.inServiceYear),
      description: String(draft.description || '').trim(),
    })
    const index = book.platformTypes.findIndex((item) => item.id === row.id)
    if (index >= 0) book.platformTypes[index] = { ...book.platformTypes[index], ...row, createdAt: book.platformTypes[index].createdAt }
    else book.platformTypes.push(row)
    book.platformLoads = book.platformLoads.filter((item) => item.platformTypeId !== row.id)
    ;(loads || []).forEach((load) => {
      const max = Number(load.maxPerPlatform)
      if (!load.loadTypeId || !Number.isInteger(max) || max < 1) return
      book.platformLoads.push(stamp({
        id: uid('carry'),
        domain: AIR,
        platformTypeId: row.id,
        loadTypeId: load.loadTypeId,
        maxPerPlatform: max,
      }))
    })
  })
}

export function deletePlatformType(id) {
  return mutate((book) => {
    const used = book.platformHoldings.some((row) => row.platformTypeId === id)
      || book.baseLimits.some((row) => row.platformTypeId === id)
      || book.platformAllotments.some((row) => row.platformTypeId === id)
    if (used) fail(new Error('This aircraft is already in a holding, a base, or an allotment.'))
    book.platformTypes = book.platformTypes.filter((row) => row.id !== id)
    book.platformLoads = book.platformLoads.filter((row) => row.platformTypeId !== id)
  })
}

export function sideView(sideId) {
  const book = read()
  return {
    platformHoldings: book.platformHoldings.filter((row) => String(row.sideId) === String(sideId)),
    loadHoldings: book.loadHoldings.filter((row) => String(row.sideId) === String(sideId)),
    baseLimits: book.baseLimits.filter((row) => String(row.sideId) === String(sideId)),
    platformAllotments: book.platformAllotments.filter((row) => String(row.sideId) === String(sideId)),
    loadAllotments: book.loadAllotments.filter((row) => String(row.sideId) === String(sideId)),
    loadIssues: book.loadIssues.filter((row) => String(row.sideId) === String(sideId)),
  }
}

export function setPlatformHolding(sideId, platformTypeId, quantity) {
  return mutate((book) => {
    putRow(book.platformHoldings, { sideId, platformTypeId, domain: AIR, quantity }, platformKey)
    assertPlatformHolding(book, sideId, platformTypeId)
  })
}

export function setLoadHolding(sideId, loadTypeId, quantity) {
  return mutate((book) => {
    putRow(book.loadHoldings, { sideId, loadTypeId, domain: AIR, quantity }, loadKey)
    assertLoadHolding(book, sideId, loadTypeId)
  })
}

export function setBaseLimit(sideId, standardNodeId, platformTypeId, maxCount) {
  return mutate((book) => {
    const count = Number(maxCount)
    if (!Number.isInteger(count) || count < 0) fail(new Error('The base limit must be a whole number.'))
    const key = `${sideId}:${standardNodeId}:${platformTypeId}`
    const index = book.baseLimits.findIndex((row) => limitKey(row) === key)
    if (count === 0) {
      if (index >= 0) book.baseLimits.splice(index, 1)
    } else {
      const row = stamp({
        id: index >= 0 ? book.baseLimits[index].id : uid('limit'),
        domain: AIR,
        sideId,
        standardNodeId,
        platformTypeId,
        maxCount: count,
      })
      if (index >= 0) book.baseLimits[index] = row
      else book.baseLimits.push(row)
    }
    assertPlatformAllotment(book, sideId, standardNodeId, platformTypeId)
  })
}

export function setPlatformAllotment(sideId, standardNodeId, platformTypeId, quantity) {
  return mutate((book) => {
    putRow(book.platformAllotments, { sideId, standardNodeId, platformTypeId, domain: AIR, quantity }, platformAtBase)
    assertPlatformAllotment(book, sideId, standardNodeId, platformTypeId)
  })
}

export function setLoadAllotment(sideId, standardNodeId, loadTypeId, quantity) {
  return mutate((book) => {
    putRow(book.loadAllotments, { sideId, standardNodeId, loadTypeId, domain: AIR, quantity }, loadAtBase)
    assertLoadAllotment(book, sideId, standardNodeId, loadTypeId)
  })
}

export function setIssue(sideId, standardNodeId, platformTypeId, loadTypeId, quantity) {
  return mutate((book) => {
    putRow(book.loadIssues, { sideId, standardNodeId, platformTypeId, loadTypeId, domain: AIR, quantity }, issueKey)
    assertIssue(book, sideId, standardNodeId, platformTypeId, loadTypeId)
  })
}

export function gameView(gameId, sideId) {
  const book = read()
  const match = (row) => String(row.gameId) === String(gameId) && String(row.sideId) === String(sideId)
  return {
    platforms: book.gamePlatforms.filter(match),
    loads: book.gameLoads.filter(match),
    issues: book.gameIssues.filter(match),
    fits: (book.gameBaseLoads || []).filter(match),
  }
}

export function setGameBaseLoad(gameId, sideId, standardNodeId, platformTypeId, loadTypeId, maxPerPlatform) {
  return mutate((book) => {
    const max = Number(maxPerPlatform)
    if (!Number.isInteger(max) || max < 0) fail(new Error('The fit must be a whole number.'))
    const keyOf = (row) => `${row.gameId}:${row.sideId}:${row.standardNodeId}:${row.platformTypeId}:${row.loadTypeId}`
    const key = `${gameId}:${sideId}:${standardNodeId}:${platformTypeId}:${loadTypeId}`
    const index = book.gameBaseLoads.findIndex((row) => keyOf(row) === key)
    const standard = book.platformLoads.find((row) => String(row.platformTypeId) === String(platformTypeId) && String(row.loadTypeId) === String(loadTypeId))
    if (!standard) fail(new Error('That aircraft cannot carry that weapon in the standard data.'))
    if (max > standard.maxPerPlatform) fail(new Error(`The standard limit is ${standard.maxPerPlatform} per aircraft.`))
    if (max === standard.maxPerPlatform) {
      if (index >= 0) book.gameBaseLoads.splice(index, 1)
    } else {
      const row = stamp({
        id: index >= 0 ? book.gameBaseLoads[index].id : uid('fit'),
        domain: AIR,
        gameId,
        sideId,
        standardNodeId,
        platformTypeId,
        loadTypeId,
        maxPerPlatform: max,
      })
      if (index >= 0) book.gameBaseLoads[index] = row
      else book.gameBaseLoads.push(row)
    }
    assertGameBaseLoad(book, gameId, sideId, standardNodeId, platformTypeId, loadTypeId)
  })
}

export function setGamePlatform(gameId, sideId, standardNodeId, platformTypeId, quantity) {
  return mutate((book) => {
    putRow(book.gamePlatforms, { gameId, sideId, standardNodeId, platformTypeId, domain: AIR, quantity }, gamePlatformKey)
    assertGamePlatform(book, gameId, sideId, standardNodeId, platformTypeId)
  })
}

export function setGameLoad(gameId, sideId, standardNodeId, loadTypeId, quantity) {
  return mutate((book) => {
    putRow(book.gameLoads, { gameId, sideId, standardNodeId, loadTypeId, domain: AIR, quantity }, gameLoadKey)
    assertGameLoad(book, gameId, sideId, standardNodeId, loadTypeId)
  })
}

export function setGameIssue(gameId, sideId, standardNodeId, platformTypeId, loadTypeId, quantity) {
  return mutate((book) => {
    putRow(book.gameIssues, { gameId, sideId, standardNodeId, platformTypeId, loadTypeId, domain: AIR, quantity }, gameIssueKey)
    assertGameIssue(book, gameId, sideId, standardNodeId, platformTypeId, loadTypeId)
  })
}

/** Puts the note's Blue pool onto a side that does not have one yet. */
export function fillExamplePool(sideId) {
  return mutate((book) => {
    const platform = (code) => book.platformTypes.find((row) => row.code === code)
    const load = (code) => book.loadTypes.find((row) => row.code === code)
    const mig = platform('MIG-21')
    const rafale = platform('RAFALE')
    const a = load('MSL-A')
    const b = load('MSL-B')
    if (!mig || !rafale || !a || !b) fail(new Error('The example types are missing.'))
    putRow(book.platformHoldings, { sideId, platformTypeId: mig.id, domain: AIR, quantity: AIR_EXAMPLE.holdings['MIG-21'] }, platformKey)
    putRow(book.platformHoldings, { sideId, platformTypeId: rafale.id, domain: AIR, quantity: AIR_EXAMPLE.holdings.RAFALE }, platformKey)
    putRow(book.loadHoldings, { sideId, loadTypeId: a.id, domain: AIR, quantity: AIR_EXAMPLE.holdings['MSL-A'] }, loadKey)
    putRow(book.loadHoldings, { sideId, loadTypeId: b.id, domain: AIR, quantity: AIR_EXAMPLE.holdings['MSL-B'] }, loadKey)
    assertPlatformHolding(book, sideId, mig.id)
    assertPlatformHolding(book, sideId, rafale.id)
    assertLoadHolding(book, sideId, a.id)
    assertLoadHolding(book, sideId, b.id)
  })
}

/** Sets the note's North limits on one airbase: MiG-21 x 3, Rafale x 2. */
export function fillExampleLimits(sideId, standardNodeId) {
  const book = read()
  const mig = book.platformTypes.find((row) => row.code === 'MIG-21')
  const rafale = book.platformTypes.find((row) => row.code === 'RAFALE')
  if (!mig || !rafale) fail(new Error('The example aircraft are missing.'))
  setBaseLimit(sideId, standardNodeId, mig.id, AIR_EXAMPLE.baseLimits['MIG-21'])
  setBaseLimit(sideId, standardNodeId, rafale.id, AIR_EXAMPLE.baseLimits.RAFALE)
  return read()
}
