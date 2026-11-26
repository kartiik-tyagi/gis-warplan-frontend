/** Soft cap on individual TileWMS sources (group WMS counts as 1). */
export const ACTIVE_WMS_BUDGET = 12

/**
 * Build OpenLayers render units from session filters.
 * Fully-on groups use one WMS name; customized groups expand to checked members only.
 */
export function renderUnitsFromFilters(filters) {
  const units = []
  for (const filter of filters || []) {
    if (filter.kind === 'group') {
      const members = filter.members || []
      if (filter.renderMode === 'members') {
        for (const member of members) {
          if (!member.visible) continue
          units.push({
            id: member.id,
            label: member.label,
            layers: member.layers,
            base: Boolean(member.base),
            transparent: member.transparent !== false,
            visible: true,
            opacity: member.opacity ?? 1,
            minZoom: member.minZoom,
            maxZoom: member.maxZoom,
          })
        }
      } else if (filter.visible && filter.layers) {
        units.push({
          id: filter.id,
          label: filter.label,
          layers: filter.layers,
          base: Boolean(filter.base),
          transparent: filter.transparent !== false,
          visible: true,
          opacity: filter.opacity ?? 1,
          minZoom: filter.minZoom,
          maxZoom: filter.maxZoom,
        })
      }
      continue
    }
    if (!filter.visible || !filter.layers) continue
    units.push({
      id: filter.id,
      label: filter.label,
      layers: filter.layers,
      base: Boolean(filter.base),
      transparent: filter.transparent !== false,
      visible: true,
      opacity: filter.opacity ?? 1,
      minZoom: filter.minZoom,
      maxZoom: filter.maxZoom,
    })
  }
  return units
}

export function countActiveWms(filters) {
  return renderUnitsFromFilters(filters).length
}

export function wouldExceedBudget(filters, nextFilters) {
  return countActiveWms(nextFilters) > ACTIVE_WMS_BUDGET
}
