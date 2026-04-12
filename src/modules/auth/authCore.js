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

export function saveAuthUsers(users, storageOverride) {
  try {
    const storage = getStorage(storageOverride)
    if (!storage) return
    storage.setItem(AUTH_USERS_KEY, JSON.stringify(Array.isArray(users) ? users : []))
  } catch {
    // ignore storage errors for non-blocking auth persistence
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
