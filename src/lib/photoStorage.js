import { getSupabase, getIsSupabaseConfigured } from './supabase.js'

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/

function extFromMime(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

/** True if value is already a public/http photo URL (safe to store in cloud). */
export function isCloudPhotoUrl(value) {
  return typeof value === 'string' && /^https?:\/\//i.test(value.trim())
}

/**
 * Upload a data-URL image to the public `photos` bucket.
 * Returns a public HTTPS URL so photos work on every device worldwide.
 * Falls back to the original data URL only when cloud is offline/unavailable.
 */
export async function uploadDataUrlPhoto(dataUrl, pathPrefix = 'misc') {
  if (!getIsSupabaseConfigured() || !getSupabase()) return dataUrl
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl
  if (!dataUrl.startsWith('data:image')) return dataUrl
  if (isCloudPhotoUrl(dataUrl)) return dataUrl

  const match = DATA_URL_RE.exec(dataUrl)
  if (!match) return dataUrl

  const mime = match[1]
  const b64 = match[2]
  const client = getSupabase()
  try {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const ext = extFromMime(mime)
    const path = `${String(pathPrefix || 'misc').replace(/[^a-zA-Z0-9/_-]/g, '_')}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await client.storage.from('photos').upload(path, bytes, {
      contentType: mime,
      upsert: true,
    })
    if (error) {
      console.warn('[photoStorage] upload failed', error.message || error)
      return dataUrl
    }
    const { data } = client.storage.from('photos').getPublicUrl(path)
    return data?.publicUrl || dataUrl
  } catch (err) {
    console.warn('[photoStorage] upload error', err)
    return dataUrl
  }
}

/**
 * Convert student/staff photo fields that are still data URLs into Storage URLs.
 * Loops in batches so large schools eventually become worldwide-ready.
 */
export async function migrateEntityPhotos(schoolId, entities, kind = 'students', limit = 40) {
  if (!Array.isArray(entities) || !entities.length) return entities
  if (!getIsSupabaseConfigured() || !getSupabase()) return entities
  const out = []
  let uploaded = 0
  for (const entity of entities) {
    if (
      uploaded >= limit ||
      !entity?.photo ||
      typeof entity.photo !== 'string' ||
      !entity.photo.startsWith('data:image')
    ) {
      out.push(entity)
      continue
    }
    const prefix = `${schoolId || 'school'}/${kind}/${entity.id || 'item'}`
    const url = await uploadDataUrlPhoto(entity.photo, prefix)
    uploaded += 1
    out.push(url === entity.photo ? entity : { ...entity, photo: url })
  }
  return out
}

/** Strip data-URL photos so bulk student upserts stay small (URLs only in DB). */
export function cloudSafePhoto(value) {
  if (!value || typeof value !== 'string') return null
  if (isCloudPhotoUrl(value)) return value.trim()
  // Keep nothing for data: / blob: — those only work on this device
  return null
}
