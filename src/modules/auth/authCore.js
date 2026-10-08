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
 * Persist auth users locally and (by default) to Supabase so admin-created
 * logins work on any device worldwide.
 * @param {{ syncCloud?: boolean }} [options] Pass syncCloud:false when hydrating from cloud.
 */
export async function saveAuthUsers(users, storageOverride, options = {}) {
  const list = Array.isArray(users) ? users : []
  const syncCloud = options.syncCloud !== false
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
    const result = await m.saveAuthUsersToCloud(list)
    if (result?.ok === false) return { ok: false, cloud: true, error: result.error }
    return { ok: true, cloud: true }
  } catch (err) {
    return { ok: false, cloud: true, error: err }
  }
}

/** Hydrate local auth users from Supabase when cloud has accounts. */
export async function hydrateAuthUsersFromCloud(storageOverride) {
  try {
    const { loadAuthUsersFromCloud, isSupabaseConfigured } = await import('../../supabaseSync.js')
    if (!isSupabaseConfigured) return loadAuthUsers(storageOverride)
    const cloud = await loadAuthUsersFromCloud()
    if (!cloud || !cloud.length) return loadAuthUsers(storageOverride)
    await saveAuthUsers(cloud, storageOverride, { syncCloud: false })
    return cloud
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
