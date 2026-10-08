export const AUTH_USERS_KEY = 'sms_auth_users'
export const AUTH_SESSION_KEY = 'sms_auth_session'

function getStorage(storageOverride) {
  if (storageOverride) return storageOverride
  if (typeof window === 'undefined') return null
  return window.localStorage
}

export function loadAuthUsers(storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return []
    const raw = storage.getItem(AUTH_USERS_KEY)
    if (!raw) return []
    const users = JSON.parse(raw)
    return Array.isArray(users) ? users : []
  } catch {
    return []
  }
}

/**
 * Merge cloud + local auth users by email.
 * Cloud wins for shared emails; local-only accounts are kept so they can be pushed up.
 */
export function mergeAuthUserLists(cloudUsers, localUsers) {
  const byEmail = new Map()
  for (const u of Array.isArray(cloudUsers) ? cloudUsers : []) {
    const em = String(u?.email || '').trim().toLowerCase()
    if (!em) continue
    byEmail.set(em, { ...u, email: em })
  }
  const localOnly = []
  for (const u of Array.isArray(localUsers) ? localUsers : []) {
    const em = String(u?.email || '').trim().toLowerCase()
    if (!em) continue
    if (byEmail.has(em)) {
      const cloud = byEmail.get(em)
      // Keep cloud record; fill empty password from local if needed
      if (!cloud.password && u.password) {
        byEmail.set(em, { ...cloud, password: u.password })
      }
    } else {
      const row = { ...u, email: em }
      byEmail.set(em, row)
      localOnly.push(row)
    }
  }
  return { merged: Array.from(byEmail.values()), localOnly }
}

/**
 * Persist auth users locally and (by default) upsert to Supabase.
 * Never deletes other cloud accounts unless deletedIds / replace is set.
 * @param {{ syncCloud?: boolean, replace?: boolean, deletedIds?: string[] }} [options]
 */
export async function saveAuthUsers(users, storageOverride, options = {}) {
  const list = Array.isArray(users) ? users : []
  const syncCloud = options.syncCloud !== false
  const replace = options.replace === true
  const deletedIds = Array.isArray(options.deletedIds) ? options.deletedIds.filter(Boolean) : []
  try {
    const storage = getStorage(storageOverride)
    if (storage) storage.setItem(AUTH_USERS_KEY, JSON.stringify(list))
  } catch {
    // ignore storage errors for non-blocking auth persistence
  }
  if (!syncCloud || storageOverride) return { ok: true, cloud: false }
  try {
    const m = await import('../../supabaseSync.js')
    if (!m.isSupabaseConfigured) return { ok: true, cloud: false }
    if (deletedIds.length) {
      const del = await m.deleteAuthUsersFromCloud(deletedIds)
      if (del?.ok === false) return { ok: false, cloud: true, error: del.error }
    }
    const result = await m.saveAuthUsersToCloud(list, { replace })
    if (result?.ok === false) return { ok: false, cloud: true, error: result.error }
    return { ok: true, cloud: true }
  } catch (err) {
    return { ok: false, cloud: true, error: err }
  }
}

/** Hydrate local auth users from Supabase; merge local-only accounts and push them up safely. */
export async function hydrateAuthUsersFromCloud(storageOverride) {
  try {
    const m = await import('../../supabaseSync.js')
    if (!m.isSupabaseConfigured) return loadAuthUsers(storageOverride)
    const cloud = (await m.loadAuthUsersFromCloud()) || []
    const local = loadAuthUsers(storageOverride)
    const { merged, localOnly } = mergeAuthUserLists(cloud, local)
    await saveAuthUsers(merged, storageOverride, { syncCloud: false })
    // Push only accounts that other devices don't have yet (upsert, no wipe)
    if (localOnly.length) {
      await m.saveAuthUsersToCloud(localOnly, { replace: false })
    }
    return merged
  } catch {
    return loadAuthUsers(storageOverride)
  }
}

export function loadAuthSession(storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return null
    const raw = storage.getItem(AUTH_SESSION_KEY)
    if (!raw) return null
    const session = JSON.parse(raw)
    return session && (session.userId || session.admin) ? session : null
  } catch {
    return null
  }
}

export function saveAuthSession(session, storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return
    if (session) storage.setItem(AUTH_SESSION_KEY, JSON.stringify(session))
    else storage.removeItem(AUTH_SESSION_KEY)
  } catch {
    // ignore storage errors for non-blocking auth persistence
  }
}

export function findUserByEmail(users, email) {
  const list = Array.isArray(users) ? users : []
  const emailNorm = String(email || '').trim().toLowerCase()
  return list.find((user) => String(user?.email || '').toLowerCase() === emailNorm) || null
}

export async function tryUserSignIn({ users, email, password, verifyPassword }) {
  const user = findUserByEmail(users, email)
  if (!user) return { ok: false, error: 'No account found with this email.' }
  if (user.blocked) return { ok: false, error: 'This account has been blocked by the administrator.' }
  if (typeof verifyPassword !== 'function') return { ok: false, error: 'verifyPassword handler is required.' }

  const passOk = await verifyPassword(password, user.password)
  if (!passOk) return { ok: false, error: 'Incorrect password.' }

  return {
    ok: true,
    session: { userId: user.id, schoolId: user.schoolId || null, userType: user.userType },
    user,
  }
}

export function tryAdminSignIn({ adminEmail, adminPassword, expectedEmail, expectedPassword }) {
  const em = String(adminEmail || '').trim().toLowerCase()
  const pass = String(adminPassword || '')
  if (em === String(expectedEmail || '').trim().toLowerCase() && pass === String(expectedPassword || '')) {
    return { ok: true, session: { admin: true } }
  }
  return { ok: false, error: 'Invalid administrator credentials.' }
}
