import { get } from '../../shared/api/http'
import { BASE_NODE_CODE } from './model'

/** Airbases are the AIRBASE nodes already in the side's standard ORBAT. */
export async function loadAirbases(sideId) {
  const types = await get('/node-types')
  const airType = (types || []).find((type) => type.code === BASE_NODE_CODE.AIR)
  let orbat = null
  try {
    orbat = await get(`/sides/${sideId}/standard-orbat`)
  } catch (error) {
    if (error?.status !== 404 && error?.code !== 'NOT_FOUND') throw error
  }
  const nodes = orbat?.orbatJson?.nodes || []
  return nodes
    .filter((node) => airType && String(node.nodeTypeId) === String(airType.id))
    .map((node) => ({
      standardNodeId: node.id,
      standardOrbatId: orbat.id,
      sideId,
      name: node.name || 'Airbase',
      latitude: node.latitude ?? null,
      longitude: node.longitude ?? null,
    }))
}
