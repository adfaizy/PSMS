/** Cross-page navigation intents (e.g. Dashboard quick action → Examination tab). */
const KEY = 'psms-nav-intent'

export function setNavIntent(intent) {
  try {
    if (!intent || typeof intent !== 'object') return
    sessionStorage.setItem(KEY, JSON.stringify({ ...intent, at: Date.now() }))
  } catch {
    /* ignore */
  }
}

/** Read and clear intent. Ignores stale intents older than 60s. */
export function consumeNavIntent() {
  try {
    const raw = sessionStorage.getItem(KEY)
    if (!raw) return null
    sessionStorage.removeItem(KEY)
    const intent = JSON.parse(raw)
    if (!intent || typeof intent !== 'object') return null
    if (intent.at && Date.now() - Number(intent.at) > 60000) return null
    return intent
  } catch {
    return null
  }
}
