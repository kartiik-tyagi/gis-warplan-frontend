/**
 * Standard force data.
 *
 * AIR is the first domain. LAND, NAVAL, and later equipments (SAGW, LRV, RADAR)
 * keep the same records and the same allotment order. Only the words change:
 * the platform (aircraft, vehicle, ship, radar), the load it carries (weapon, round),
 * and the ORBAT node that acts as the base (AIRBASE, a future battery, NAVAL_PORT).
 *
 * Proposed tables, one array each. Keys are the ids. Quantities are counts of a type,
 * never individually named platforms. updatedAt is the audit stamp until the backend
 * adds the actor.
 *
 *   platform_type            aircraft / vehicle / ship / radar type
 *   load_type                weapon or other load type
 *   platform_load            what one platform of a type may carry, and the max
 *   side_platform_holding    the side's pool of a platform type
 *   side_load_holding        the side's pool of a load type
 *   base_platform_limit      what one ORBAT base node may hold of a platform type
 *   platform_allotment       platforms moved from the side pool onto that base
 *   load_allotment           loads moved from the side pool into that base's stock
 *   load_issue               loads issued from that base stock onto platforms at that base
 *   game_platform            how many of a base's allotted platforms are in a game
 *   game_load                how much of a base's stock is in a game
 *   game_issue               how much of an issue is in a game
 *
 * The base is an existing standard ORBAT node (standardNodeId). There is no second
 * airbase record. A playing node points back with sourceNodeId.
 */

export const DOMAINS = Object.freeze({
  AIR: 'AIR',
  LAND: 'LAND',
  NAVAL: 'NAVAL',
})

/** ORBAT node type that is the "base" for a domain. Land is named when that domain is built. */
export const BASE_NODE_CODE = Object.freeze({
  AIR: 'AIRBASE',
  NAVAL: 'NAVAL_PORT',
})

export const AIR = DOMAINS.AIR

export function emptyBook() {
  return {
    platformTypes: [],
    loadTypes: [],
    platformLoads: [],
    platformHoldings: [],
    loadHoldings: [],
    baseLimits: [],
    platformAllotments: [],
    loadAllotments: [],
    loadIssues: [],
    gamePlatforms: [],
    gameLoads: [],
    gameIssues: [],
    gameBaseLoads: [],
  }
}

export function uid(prefix) {
  const body = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`
  return `${prefix}-${body}`
}

export function stamp(row) {
  const now = new Date().toISOString()
  return { ...row, updatedAt: now, createdAt: row.createdAt || now }
}

function qty(value) {
  const number = Number(value)
  if (!Number.isInteger(number) || number < 0) {
    return null
  }
  return number
}

function sum(rows) {
  return rows.reduce((total, row) => total + Number(row.quantity || 0), 0)
}

function same(left, right) {
  return String(left) === String(right)
}

export function holdingOf(rows, sideId, typeId, typeKey) {
  return rows.find((row) => same(row.sideId, sideId) && same(row[typeKey], typeId)) || null
}

export function limitOf(book, sideId, standardNodeId, platformTypeId) {
  return book.baseLimits.find((row) => same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId)
    && same(row.platformTypeId, platformTypeId)) || null
}

export function loadLimit(book, platformTypeId, loadTypeId) {
  return book.platformLoads.find((row) => same(row.platformTypeId, platformTypeId) && same(row.loadTypeId, loadTypeId)) || null
}

/** The weapon fit used in one game at one base. Absent means the standard fit. It cannot rise above the standard maximum. */
export function gameCarry(book, gameId, sideId, standardNodeId, platformTypeId, loadTypeId) {
  const standard = loadLimit(book, platformTypeId, loadTypeId)
  if (!standard) return null
  const custom = (book.gameBaseLoads || []).find((row) => same(row.gameId, gameId)
    && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId)
    && same(row.platformTypeId, platformTypeId)
    && same(row.loadTypeId, loadTypeId))
  return {
    standardMax: standard.maxPerPlatform,
    max: custom ? custom.maxPerPlatform : standard.maxPerPlatform,
    custom: Boolean(custom),
  }
}

function reject(message) {
  const error = new Error(message)
  error.code = 'CONFLICT'
  throw error
}

function requireQty(value, label) {
  const number = qty(value)
  if (number == null) reject(`${label} must be a whole number, zero or more.`)
  return number
}

/** Replace one row identified by key, or drop it when the quantity is zero. */
export function putRow(list, row, keyOf) {
  const quantity = requireQty(row.quantity, 'Quantity')
  const key = keyOf(row)
  const index = list.findIndex((item) => keyOf(item) === key)
  if (quantity === 0) {
    if (index >= 0) list.splice(index, 1)
    return null
  }
  const next = stamp({ ...(index >= 0 ? list[index] : {}), ...row, quantity, id: (index >= 0 ? list[index].id : row.id) || uid('row') })
  if (index >= 0) list[index] = next
  else list.push(next)
  return next
}

function platformAllotted(book, sideId, standardNodeId, platformTypeId) {
  const row = book.platformAllotments.find((item) => same(item.sideId, sideId)
    && same(item.standardNodeId, standardNodeId)
    && same(item.platformTypeId, platformTypeId))
  return row ? row.quantity : 0
}

function loadStock(book, sideId, standardNodeId, loadTypeId) {
  const row = book.loadAllotments.find((item) => same(item.sideId, sideId)
    && same(item.standardNodeId, standardNodeId)
    && same(item.loadTypeId, loadTypeId))
  return row ? row.quantity : 0
}

function issued(book, sideId, standardNodeId, platformTypeId, loadTypeId) {
  const row = book.loadIssues.find((item) => same(item.sideId, sideId)
    && same(item.standardNodeId, standardNodeId)
    && same(item.platformTypeId, platformTypeId)
    && same(item.loadTypeId, loadTypeId))
  return row ? row.quantity : 0
}

/** The side pool, what other bases already took, and what this base is allowed. */
export function platformRoom(book, sideId, standardNodeId, platformTypeId) {
  const holding = holdingOf(book.platformHoldings, sideId, platformTypeId, 'platformTypeId')
  const owned = holding ? holding.quantity : 0
  const elsewhere = sum(book.platformAllotments.filter((row) => same(row.sideId, sideId)
    && same(row.platformTypeId, platformTypeId)
    && !same(row.standardNodeId, standardNodeId)))
  const limit = limitOf(book, sideId, standardNodeId, platformTypeId)
  return { owned, elsewhere, baseMax: limit ? limit.maxCount : 0, configured: Boolean(limit) }
}

export function loadRoom(book, sideId, standardNodeId, loadTypeId) {
  const holding = holdingOf(book.loadHoldings, sideId, loadTypeId, 'loadTypeId')
  const owned = holding ? holding.quantity : 0
  const elsewhere = sum(book.loadAllotments.filter((row) => same(row.sideId, sideId)
    && same(row.loadTypeId, loadTypeId)
    && !same(row.standardNodeId, standardNodeId)))
  const issuedHere = sum(book.loadIssues.filter((row) => same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId)
    && same(row.loadTypeId, loadTypeId)))
  return { owned, elsewhere, issuedHere }
}

export function issueRoom(book, sideId, standardNodeId, platformTypeId, loadTypeId) {
  const allotted = platformAllotted(book, sideId, standardNodeId, platformTypeId)
  const rule = loadLimit(book, platformTypeId, loadTypeId)
  const perPlatform = rule ? rule.maxPerPlatform : 0
  const stock = loadStock(book, sideId, standardNodeId, loadTypeId)
  const others = sum(book.loadIssues.filter((row) => same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId)
    && same(row.loadTypeId, loadTypeId)
    && !same(row.platformTypeId, platformTypeId)))
  return {
    allotted,
    perPlatform,
    allowed: Boolean(rule),
    capacity: allotted * perPlatform,
    stock,
    stockLeft: Math.max(0, stock - others),
  }
}

export function assertPlatformHolding(book, sideId, platformTypeId) {
  const owned = holdingOf(book.platformHoldings, sideId, platformTypeId, 'platformTypeId')?.quantity || 0
  const used = sum(book.platformAllotments.filter((row) => same(row.sideId, sideId) && same(row.platformTypeId, platformTypeId)))
  if (used > owned) reject(`The side holds ${owned}, and ${used} are already allotted to bases.`)
}

export function assertLoadHolding(book, sideId, loadTypeId) {
  const owned = holdingOf(book.loadHoldings, sideId, loadTypeId, 'loadTypeId')?.quantity || 0
  const used = sum(book.loadAllotments.filter((row) => same(row.sideId, sideId) && same(row.loadTypeId, loadTypeId)))
  if (used > owned) reject(`The side holds ${owned}, and ${used} are already in base stocks.`)
}

export function assertPlatformAllotment(book, sideId, standardNodeId, platformTypeId) {
  const quantity = platformAllotted(book, sideId, standardNodeId, platformTypeId)
  const room = platformRoom(book, sideId, standardNodeId, platformTypeId)
  if (quantity > 0 && !room.configured) reject('This base is not configured to hold that type.')
  if (quantity > room.baseMax) reject(`This base allows ${room.baseMax} of that type.`)
  if (room.elsewhere + quantity > room.owned) {
    reject(`The side holds ${room.owned}. ${room.elsewhere} are already on other bases.`)
  }
  book.loadIssues
    .filter((row) => same(row.sideId, sideId) && same(row.standardNodeId, standardNodeId) && same(row.platformTypeId, platformTypeId))
    .forEach((row) => {
      const rule = loadLimit(book, platformTypeId, row.loadTypeId)
      const capacity = quantity * (rule ? rule.maxPerPlatform : 0)
      if (row.quantity > capacity) {
        reject(`Weapons already issued need at least enough aircraft to carry them. ${row.quantity} are issued and ${quantity} aircraft can carry ${capacity}.`)
      }
    })
}

export function assertLoadAllotment(book, sideId, standardNodeId, loadTypeId) {
  const quantity = loadStock(book, sideId, standardNodeId, loadTypeId)
  const room = loadRoom(book, sideId, standardNodeId, loadTypeId)
  if (room.elsewhere + quantity > room.owned) {
    reject(`The side holds ${room.owned}. ${room.elsewhere} are already in other base stocks.`)
  }
  if (room.issuedHere > quantity) {
    reject(`This base has already issued ${room.issuedHere}. The stock cannot fall below that.`)
  }
}

export function assertIssue(book, sideId, standardNodeId, platformTypeId, loadTypeId) {
  const quantity = issued(book, sideId, standardNodeId, platformTypeId, loadTypeId)
  const room = issueRoom(book, sideId, standardNodeId, platformTypeId, loadTypeId)
  if (quantity === 0) return
  if (room.allotted <= 0) reject('That type is not allotted to this base.')
  if (!room.allowed) reject('That type cannot carry that weapon.')
  if (quantity > room.capacity) reject(`Those aircraft can carry ${room.capacity} in total.`)
  const used = sum(book.loadIssues.filter((row) => same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId)
    && same(row.loadTypeId, loadTypeId)))
  if (used > room.stock) reject(`The base stock holds ${room.stock}, and ${used} would be issued.`)
}

function gameQty(rows, match) {
  const row = rows.find(match)
  return row ? row.quantity : 0
}

export function assertGamePlatform(book, gameId, sideId, standardNodeId, platformTypeId) {
  const quantity = gameQty(book.gamePlatforms, (row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.platformTypeId, platformTypeId))
  const standard = platformAllotted(book, sideId, standardNodeId, platformTypeId)
  if (quantity > standard) reject(`The standard allotment at this base is ${standard}.`)
  book.gameIssues
    .filter((row) => same(row.gameId, gameId) && same(row.sideId, sideId)
      && same(row.standardNodeId, standardNodeId) && same(row.platformTypeId, platformTypeId))
    .forEach((row) => {
      const carry = gameCarry(book, gameId, sideId, standardNodeId, platformTypeId, row.loadTypeId)
      const capacity = quantity * (carry ? carry.max : 0)
      if (row.quantity > capacity) reject('The game has already issued more than the aircraft it is taking can carry.')
    })
}

export function assertGameLoad(book, gameId, sideId, standardNodeId, loadTypeId) {
  const quantity = gameQty(book.gameLoads, (row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.loadTypeId, loadTypeId))
  const standard = loadStock(book, sideId, standardNodeId, loadTypeId)
  if (quantity > standard) reject(`The standard stock at this base is ${standard}.`)
  const issuedInGame = sum(book.gameIssues.filter((row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.loadTypeId, loadTypeId)))
  if (issuedInGame > quantity) reject('The game has already issued more than the stock it is taking.')
}

export function assertGameIssue(book, gameId, sideId, standardNodeId, platformTypeId, loadTypeId) {
  const quantity = gameQty(book.gameIssues, (row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.platformTypeId, platformTypeId) && same(row.loadTypeId, loadTypeId))
  const standard = issued(book, sideId, standardNodeId, platformTypeId, loadTypeId)
  if (quantity > standard) reject(`The standard issue at this base is ${standard}.`)
  const taken = gameQty(book.gamePlatforms, (row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.platformTypeId, platformTypeId))
  const carry = gameCarry(book, gameId, sideId, standardNodeId, platformTypeId, loadTypeId)
  if (quantity > 0 && !carry) reject('That type cannot carry that weapon.')
  const capacity = (carry ? carry.max : 0) * taken
  if (quantity > capacity) reject(`The aircraft taken into the game can carry ${capacity}.`)
  const stock = gameQty(book.gameLoads, (row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.loadTypeId, loadTypeId))
  const used = sum(book.gameIssues.filter((row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.loadTypeId, loadTypeId)))
  if (used > stock) reject(`The stock taken into the game is ${stock}.`)
}

export function assertGameBaseLoad(book, gameId, sideId, standardNodeId, platformTypeId, loadTypeId) {
  const carry = gameCarry(book, gameId, sideId, standardNodeId, platformTypeId, loadTypeId)
  if (!carry) reject('That aircraft cannot carry that weapon in the standard data.')
  if (carry.max > carry.standardMax) reject(`The standard limit is ${carry.standardMax} per aircraft.`)
  const taken = gameQty(book.gamePlatforms, (row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.platformTypeId, platformTypeId))
  const issuedInGame = gameQty(book.gameIssues, (row) => same(row.gameId, gameId) && same(row.sideId, sideId)
    && same(row.standardNodeId, standardNodeId) && same(row.platformTypeId, platformTypeId) && same(row.loadTypeId, loadTypeId))
  if (issuedInGame > taken * carry.max) reject('Weapons already issued in this game need a higher fit, or fewer issued.')
}

/** The example in the air note, used to fill an empty side. */
export const AIR_EXAMPLE = Object.freeze({
  loads: [
    {
      code: 'MSL-A',
      name: 'Missile A',
      category: 'missile',
      guidance: 'Active radar',
      rangeKm: 80,
      warheadKg: 40,
      weightKg: 250,
      lengthM: 3.7,
      status: 'in_service',
      description: 'Beyond-visual-range missile. Exercise figure.',
    },
    {
      code: 'MSL-B',
      name: 'Missile B',
      category: 'missile',
      guidance: 'Infrared',
      rangeKm: 20,
      warheadKg: 11,
      weightKg: 85,
      lengthM: 2.9,
      status: 'in_service',
      description: 'Short-range missile. Exercise figure.',
    },
  ],
  platforms: [
    {
      code: 'MIG-21',
      name: 'MiG-21',
      role: 'fighter',
      manufacturer: 'Mikoyan',
      crew: 1,
      maxSpeedKmh: 2175,
      combatRadiusKm: 370,
      ceilingM: 17500,
      hardpoints: 4,
      inServiceYear: 1959,
      description: 'Single-seat fighter. Exercise figure.',
      loads: [{ code: 'MSL-A', maxPerPlatform: 2 }],
    },
    {
      code: 'RAFALE',
      name: 'Rafale',
      role: 'fighter',
      manufacturer: 'Dassault',
      crew: 1,
      maxSpeedKmh: 1912,
      combatRadiusKm: 1850,
      ceilingM: 15240,
      hardpoints: 14,
      inServiceYear: 2001,
      description: 'Single-seat multirole fighter. Exercise figure.',
      loads: [
        { code: 'MSL-A', maxPerPlatform: 4 },
        { code: 'MSL-B', maxPerPlatform: 2 },
      ],
    },
  ],
  holdings: { 'MIG-21': 10, RAFALE: 6, 'MSL-A': 40, 'MSL-B': 12 },
  baseLimits: { 'MIG-21': 3, RAFALE: 2 },
})
