import { FunctionalityCodes, hasFunctionality } from './functionalityCodes'

export function hasAny(functionalities, ...codes) {
  return codes.some((code) => hasFunctionality(functionalities, code))
}

/** Any of the separate administration screens. */
export function canOpenDirectory(functionalities) {
  return hasAny(
    functionalities,
    FunctionalityCodes.MANAGE_USERS,
    FunctionalityCodes.MANAGE_SIDES,
    FunctionalityCodes.MANAGE_ROLES,
    FunctionalityCodes.MANAGE_THEMES,
    FunctionalityCodes.MANAGE_NODE_TYPES,
  )
}

/** Any ORBAT capability opens the ORBAT panel. */
export function canOpenOrbat(functionalities) {
  return hasAny(
    functionalities,
    FunctionalityCodes.MANAGE_STANDARD_ORBAT,
    FunctionalityCodes.MANAGE_PLAYING_ORBAT,
    FunctionalityCodes.MANAGE_ALLIANCE,
    FunctionalityCodes.MARK_AS_USER,
  )
}

export function isAdminLike(functionalities) {
  return canOpenDirectory(functionalities) || canOpenOrbat(functionalities)
}

function item(id, label, icon) {
  return { id, label, icon }
}

/** Session-level navigation: only backend-supported tools. */
export function navigationForFunctionalities(functionalities) {
  const groups = []
  if (hasFunctionality(functionalities, FunctionalityCodes.MAP_VIEW)) {
    const mapItems = [item('filters', 'Map Filters', 'layers'), item('extent', 'Home Extent', 'extent')]
    groups.push({ id: 'map', label: 'Map', items: mapItems })
  }
  const orbatItems = []
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_STANDARD_ORBAT)) {
    orbatItems.push(item('orbat-standard', 'Standard', 'orbat'))
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_PLAYING_ORBAT)) {
    orbatItems.push(item('orbat-playing', 'Playing', 'flight'))
  }
  if (orbatItems.length) groups.push({ id: 'orbat', label: 'ORBAT', items: orbatItems })

  return groups
}

/** Application-menu sections, gated by functionality. */
export function sectionsForFunctionalities(functionalities) {
  const sections = []
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_SCENARIO)) {
    sections.push({ id: 'scenario', kicker: 'Exercise', label: 'Scenario Management', icon: 'flag' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_GAME)) {
    sections.push({ id: 'game', kicker: 'Exercise', label: 'Game Management', icon: 'control' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_MAP)) {
    sections.push({ id: 'map-catalog', kicker: 'Map', label: 'Map Catalog', icon: 'settings' })
  }
  if (canOpenOrbat(functionalities)) sections.push({ id: 'orbat', kicker: 'ORBAT', label: 'ORBAT', icon: 'orbat' })
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_STANDARD_ORBAT)) {
    sections.push({ id: 'air', kicker: 'Standard Data', label: 'Air', icon: 'flight' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_SIDES)) {
    sections.push({ id: 'teams', kicker: 'Standard Data', label: 'Sides', icon: 'teams' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_NODE_TYPES)) {
    sections.push({ id: 'node-types', kicker: 'Standard Data', label: 'Node Types', icon: 'table' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_THEMES)) {
    sections.push({ id: 'themes', kicker: 'Standard Data', label: 'Themes', icon: 'themes' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_USERS)) {
    sections.push({ id: 'users', kicker: 'Access', label: 'Users', icon: 'users' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_ROLES)) {
    sections.push({ id: 'roles', kicker: 'Access', label: 'Roles', icon: 'roles' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.VIEW_AUDIT)) {
    sections.push({ id: 'audit', kicker: 'Records', label: 'Audit', icon: 'sessions' })
  }
  if (hasFunctionality(functionalities, FunctionalityCodes.MANAGE_ICONS)) {
    sections.push({ id: 'icons', kicker: 'Records', label: 'Icons', icon: 'table' })
  }
  return sections
}

/** Application-menu sections that open in the work window over the map. */
export const SECTION_ROUTE = Object.freeze({
  scenario: '/exercise/scenarios',
  game: '/exercise/games',
  'map-catalog': '/map/catalog',
  air: '/standard/air',
  teams: '/standard/teams',
  themes: '/standard/themes',
  'node-types': '/standard/node-types',
  audit: '/records/audit',
  users: '/access/users',
  roles: '/access/roles',
  icons: '/records/icons',
})

const SECTION_TITLE = Object.freeze({
  scenario: 'Scenario Management',
  game: 'Game Management',
  'map-catalog': 'Map Catalog',
  air: 'Air',
  teams: 'Sides',
  themes: 'Themes',
  'node-types': 'Node Types',
  audit: 'Audit',
  users: 'Users',
  roles: 'Roles',
  icons: 'Icons',
})

/** The work-window section for a path, or null when the map is showing on its own. */
export function sectionFromPath(pathname) {
  const match = Object.entries(SECTION_ROUTE).find(
    ([, route]) => pathname === route || pathname.startsWith(`${route}/`),
  )
  if (!match) return null
  return { id: match[0], title: SECTION_TITLE[match[0]] }
}

/** Which tool panel an application-menu section opens (dock panels). */
export const SECTION_PANEL = Object.freeze({
  orbat: 'orbat',
})
