/**
 * Sync student photos from the local Photos/<Class>/ folder (dev server).
 * Used by manual Sync and automatic folder watching.
 */
import { normalizeRollNo, formatClassDisplay, formatGradeLabel, resolveClass, readStudentPhotoAsJpeg, isDisplayablePhotoSrc } from '../shared/helpers.js'
import { uploadDataUrlPhoto, isCloudPhotoUrl } from './photoStorage.js'

export function rollKeyFromPhotoFilename(filename) {
  const base = String(filename || '').replace(/\.[^.]+$/, '').trim()
  if (!base) return ''
  if (/^\d+$/.test(base)) return normalizeRollNo(base)
  const paren = base.match(/^\(\s*(\d+)\s*\)$/)
  if (paren) return normalizeRollNo(paren[1])
  const digits = base.match(/\d+/)
  return digits ? normalizeRollNo(digits[0]) : ''
}

export function folderNamesForClass(c) {
  const names = new Set()
  ;[
    formatClassDisplay(c),
    c?.name,
    c?.id,
    c?.grade,
    formatGradeLabel(c?.grade),
    `${c?.grade || ''}${c?.section ? `-${c.section}` : ''}`,
  ]
    .map((v) => String(v || '').trim())
    .filter(Boolean)
    .forEach((v) => names.add(v))
  return [...names]
}

/** Primary Photos/<Class>/ folder name for a class (safe for Windows paths). */
export function preferredPhotoFolderName(c) {
  const label = String(formatClassDisplay(c) || c?.name || c?.grade || '').trim()
  return label
    .replace(/[<>:"/\\|?*\x00-\x1f]/g, '-')
    .replace(/\s+/g, ' ')
    .replace(/[. ]+$/g, '')
    .trim()
}

/**
 * Create Photos/<Class>/ folders on the main PC (dev server) for the given classes.
 * Called when classes are added in Settings or imported from Excel.
 */
export async function ensureClassPhotoFolders(classes) {
  const list = Array.isArray(classes) ? classes : []
  const folders = [
    ...new Set(
      list
        .map((c) => preferredPhotoFolderName(c))
        .filter(Boolean),
    ),
  ]
  if (!folders.length) return { ok: false, skipped: true, created: [], existing: [], failed: [] }
  try {
    const res = await fetch('/Photos-api/ensure-folders', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ folders }),
      cache: 'no-store',
    })
    const json = res.ok ? await res.json() : { ok: false, created: [], existing: [], failed: folders }
    return {
      ok: !!json.ok,
      created: Array.isArray(json.created) ? json.created : [],
      existing: Array.isArray(json.existing) ? json.existing : [],
      failed: Array.isArray(json.failed) ? json.failed : [],
    }
  } catch (err) {
    console.warn('[photosFolderSync] ensure-folders failed', err)
    return { ok: false, created: [], existing: [], failed: folders, error: err }
  }
}

/** List images + change signature for a Photos subfolder. */
export async function listPhotosFolder(folder) {
  try {
    const res = await fetch(`/Photos-api/list-folder?name=${encodeURIComponent(folder)}`, {
      cache: 'no-store',
    })
    const json = res.ok ? await res.json() : { files: [], signature: '', exists: false }
    const files = Array.isArray(json.files) ? json.files : []
    // Normalize to { name, size, mtime }
    const normalized = files.map((f) =>
      typeof f === 'string'
        ? { name: f, size: 0, mtime: 0 }
        : {
            name: String(f.name || ''),
            size: Number(f.size) || 0,
            mtime: Number(f.mtime) || 0,
          },
    )
    const signature =
      json.signature ||
      normalized
        .map((f) => `${f.name}:${f.size}:${f.mtime}`)
        .sort()
        .join('|')
    return {
      exists: !!json.exists || normalized.length > 0,
      files: normalized,
      signature,
    }
  } catch {
    return { exists: false, files: [], signature: '' }
  }
}

async function fetchPhotoDataUrl(folder, fileName) {
  const url = `/Photos/${encodeURIComponent(folder)}/${encodeURIComponent(fileName)}`
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) return null
  const ctype = String(res.headers.get('content-type') || '').toLowerCase()
  if (ctype.includes('text/html') || ctype.includes('application/json')) return null
  const blob = await res.blob()
  if (!blob || !blob.size || blob.size < 32) return null
  if (String(blob.type || '').includes('text/html')) return null
  const file = new File([blob], fileName, { type: blob.type || ctype || 'image/jpeg' })
  const data = await readStudentPhotoAsJpeg(file)
  return isDisplayablePhotoSrc(data) ? data : null
}

/**
 * Sync all (or filtered) students against Photos folders.
 * Returns { updates, pendingCloudUpload, stats, folderSignature }.
 * `updates[id]` = dataURL | null (clear).
 */
export async function syncStudentsFromPhotosFolder({
  students,
  classes,
  schoolId,
  yieldToMain,
  fileSigByStudentRef,
}) {
  const list = Array.isArray(students) ? students : []
  const classList = Array.isArray(classes) ? classes : []
  const folderCache = {}
  const listFolder = async (folder) => {
    if (folderCache[folder]) return folderCache[folder]
    folderCache[folder] = await listPhotosFolder(folder)
    return folderCache[folder]
  }

  const findHit = async (folders, roll) => {
    const want = normalizeRollNo(roll)
    if (!want) return null
    for (const folder of folders) {
      const listed = await listFolder(folder)
      if (!listed.exists) continue
      const match = listed.files.find((f) => rollKeyFromPhotoFilename(f.name) === want)
      if (match) return { folder, file: match }
    }
    return null
  }

  let applied = 0
  let removed = 0
  let missing = 0
  let failed = 0
  let skippedNoFolder = 0
  let unchanged = 0
  const updates = {}
  const pendingCloudUpload = []
  const sigMap = fileSigByStudentRef?.current || {}

  for (const s of list) {
    const sc = resolveClass(classList, s.classId)
    if (!sc) {
      missing++
      continue
    }
    const roll = normalizeRollNo(s.rollNo)
    if (!roll) {
      missing++
      continue
    }
    const folders = folderNamesForClass(sc)
    let folderOk = false
    for (const folder of folders) {
      const listed = await listFolder(folder)
      if (listed.exists) {
        folderOk = true
        break
      }
    }
    if (!folderOk) {
      skippedNoFolder++
      continue
    }

    try {
      const hit = await findHit(folders, roll)
      if (hit) {
        const fileSig = `${hit.folder}/${hit.file.name}:${hit.file.size}:${hit.file.mtime}`
        const prevSig = sigMap[s.id]
        const hasGoodPhoto = isDisplayablePhotoSrc(s.photo) || isCloudPhotoUrl(s.photo)
        // Skip re-download if same file already applied and student still has a displayable photo
        if (prevSig === fileSig && hasGoodPhoto) {
          unchanged++
          continue
        }
        const photo = await fetchPhotoDataUrl(hit.folder, hit.file.name)
        if (photo) {
          updates[s.id] = photo
          pendingCloudUpload.push({ id: s.id, photo, schoolId })
          sigMap[s.id] = fileSig
          applied++
        } else {
          failed++
        }
      } else if (s.photo) {
        // File gone from folder → clear on this device + worldwide (via later cloud push)
        updates[s.id] = null
        delete sigMap[s.id]
        removed++
      } else {
        missing++
      }
    } catch {
      failed++
    }
    if (typeof yieldToMain === 'function' && (applied + removed + missing + failed) % 10 === 0) {
      await yieldToMain()
    }
  }

  if (fileSigByStudentRef) fileSigByStudentRef.current = sigMap

  const folderSignature = Object.keys(folderCache)
    .sort()
    .map((k) => `${k}=${folderCache[k].signature}`)
    .join('||')

  return {
    updates,
    pendingCloudUpload,
    folderSignature,
    stats: { applied, removed, missing, failed, skippedNoFolder, unchanged },
  }
}

/** Upload data-URL photos to public Storage (worldwide). */
export async function uploadPendingPhotosWorldwide(pending, { yieldToMain } = {}) {
  const cloudUpdates = {}
  for (const item of pending || []) {
    try {
      if (!item?.photo || isCloudPhotoUrl(item.photo)) continue
      const prefix = `${item.schoolId || 'school'}/students/${item.id || 'item'}`
      const url = await uploadDataUrlPhoto(item.photo, prefix)
      if (url && isCloudPhotoUrl(url)) cloudUpdates[item.id] = url
    } catch {
      /* keep local */
    }
    if (typeof yieldToMain === 'function') await yieldToMain()
  }
  return cloudUpdates
}
