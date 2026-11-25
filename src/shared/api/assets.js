import { appServiceUnreachable } from '../brand'
import { ApiError } from './errors'
import { API_BASE, del, get, post, put } from './http'
import { getToken } from './tokenStore'

/** Folder and the three size limits. */
export const getAssetSettings = () => get('/asset-management')

/** Changes the base folder and, when given, the size limits. */
export const updateAssetSettings = (body) => put('/asset-management', body)

export const listAssets = (kind) => get('/assets', { kind })

export const setAssetLabel = (id, label) => put(`/assets/${id}/label`, { label })

export const clearAssetLabel = (id) => del(`/assets/${id}/label`)

export const deleteAsset = (id) => del(`/assets/${id}`)

/** Uploads one file into a kind. The server message is the error the person sees. */
export async function uploadAsset(file, kind, label) {
  if (!file) throw new ApiError('Choose a file to upload.', 'VALIDATION')
  const formData = new FormData()
  formData.append('file', file)
  formData.append('kind', kind)
  if (label) formData.append('label', label)
  return sendForm('/assets', formData)
}

export async function replaceApplicationPicture(slot, file) {
  if (!file) throw new ApiError('Choose a file to upload.', 'VALIDATION')
  const formData = new FormData()
  formData.append('file', file)
  return sendForm(`/assets/application/${slot}`, formData, 'PUT')
}

/** Attaches a document or image to a scenario through the asset store. */
export function uploadScenarioAttachment(scenarioId, file) {
  if (!file) throw new ApiError('Choose a file to upload.', 'VALIDATION')
  const formData = new FormData()
  formData.append('file', file)
  return sendForm(`/scenarios/${scenarioId}/attachment`, formData)
}

/** Saves a drawing as a new SVG icon. The original file is left unchanged. */
export const drawIcon = ({ name, directory, label, svg }) => post('/icons/draw', { name, directory, label, svg })

async function sendForm(path, formData, method = 'POST') {
  const headers = { Accept: 'application/json' }
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let response
  try {
    response = await fetch(`${API_BASE}${path}`, { method, headers, body: formData })
  } catch {
    throw new ApiError(appServiceUnreachable(), 'UNAVAILABLE')
  }
  if (!response.ok) {
    let payload = null
    try {
      payload = await response.json()
    } catch {
      payload = null
    }
    throw new ApiError(payload?.message || `Upload failed (${response.status}).`, payload?.code || 'HTTP_' + response.status)
  }
  if (response.status === 204) return null
  return response.json()
}
