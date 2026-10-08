import { supabase, isSupabaseConfigured } from './supabase.js'

const DATA_URL_RE = /^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/

function extFromMime(mime) {
  if (mime === 'image/png') return 'png'
  if (mime === 'image/webp') return 'webp'
  if (mime === 'image/gif') return 'gif'
  return 'jpg'
}

/**
 * Upload a data-URL image to the public `photos` bucket.
 * Returns a public HTTPS URL, or the original value if upload is skipped/fails.
 */
export async function uploadDataUrlPhoto(dataUrl, pathPrefix = 'misc') {
  if (!isSupabaseConfigured || !supabase) return dataUrl
  if (!dataUrl || typeof dataUrl !== 'string') return dataUrl
  if (!dataUrl.startsWith('data:image')) return dataUrl

  const match = DATA_URL_RE.exec(dataUrl)
  if (!match) return dataUrl

  const mime = match[1]
  const b64 = match[2]
  try {
    const binary = atob(b64)
    const bytes = new Uint8Array(binary.length)
    for (let i = 0; i < binary.length; i += 1) bytes[i] = binary.charCodeAt(i)
    const ext = extFromMime(mime)
    const path = `${String(pathPrefix || 'misc').replace(/[^a-zA-Z0-9/_-]/g, '_')}/${Date.now()}-${Math.random().toString(36).slice(2, 8)}.${ext}`
    const { error } = await supabase.storage.from('photos').upload(path, bytes, {
      contentType: mime,
      upsert: true,
    })
    if (error) {
      console.warn('[photoStorage] upload failed', error.message || error)
      return dataUrl
    }
    const { data } = supabase.storage.from('photos').getPublicUrl(path)
    return data?.publicUrl || dataUrl
  } catch (err) {
    console.warn('[photoStorage] upload error', err)
    return dataUrl
  }
}

/**
 * Convert student/staff photo fields that are still data URLs into Storage URLs.
 * `limit` caps how many uploads run per call so saves stay responsive.
 */
export async function migrateEntityPhotos(schoolId, entities, kind = 'students', limit = 20) {
  if (!Array.isArray(entities) || !entities.length) return entities
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
