import { createClient } from '@supabase/supabase-js'

function readRuntimeCloud() {
  try {
    if (typeof window === 'undefined') return { url: '', anonKey: '' }
    const cfg = window.__PSMS_CLOUD__
    if (!cfg || typeof cfg !== 'object') return { url: '', anonKey: '' }
    return {
      url: String(cfg.url || cfg.supabaseUrl || '').trim(),
      anonKey: String(cfg.anonKey || cfg.supabaseAnonKey || '').trim(),
    }
  } catch {
    return { url: '', anonKey: '' }
  }
}

function resolveCloudConfig() {
  const fromEnvUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const fromEnvKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  const runtime = readRuntimeCloud()
  // Prefer Vite env when present; otherwise public/psms-config.js (all browsers/devices)
  return {
    url: fromEnvUrl || runtime.url || '',
    anonKey: fromEnvKey || runtime.anonKey || '',
  }
}

function makeClient(url, anonKey) {
  return createClient(url, anonKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  })
}

let { url: supabaseUrl, anonKey: supabaseAnonKey } = resolveCloudConfig()

/** Live binding — becomes true after config is found (env or public/psms-config.js). */
export let isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)

export let supabase = isSupabaseConfigured
  ? makeClient(supabaseUrl, supabaseAnonKey)
  : null

/**
 * Re-read public config (and optional /psms-config.json) so other browsers
 * that load the shared app can turn Cloud ON even without local .env.
 */
export async function initSupabaseCloud() {
  // Script tag may have set window.__PSMS_CLOUD__ already
  let next = resolveCloudConfig()

  if ((!next.url || !next.anonKey) && typeof window !== 'undefined') {
    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
      const res = await fetch(`${base}psms-config.json`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        next = {
          url: String(json.url || json.supabaseUrl || '').trim(),
          anonKey: String(json.anonKey || json.supabaseAnonKey || '').trim(),
        }
        if (next.url && next.anonKey) {
          window.__PSMS_CLOUD__ = next
        }
      }
    } catch {
      // ignore — stay on env / prior config
    }
  }

  supabaseUrl = next.url
  supabaseAnonKey = next.anonKey
  isSupabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
  supabase = isSupabaseConfigured ? makeClient(supabaseUrl, supabaseAnonKey) : null
  return { ok: isSupabaseConfigured, url: supabaseUrl }
}

/** Quick connectivity check used by Admin Cloud badge. */
export async function pingSupabaseCloud(timeoutMs = 8000) {
  if (!isSupabaseConfigured || !supabase) return { ok: false, reason: 'not_configured' }
  try {
    const result = await Promise.race([
      supabase.from('app_users').select('id', { count: 'exact', head: true }),
      new Promise((_, reject) => {
        setTimeout(() => reject(new Error('timeout')), timeoutMs)
      }),
    ])
    if (result?.error) return { ok: false, reason: result.error.message || 'query_failed' }
    return { ok: true }
  } catch (err) {
    return { ok: false, reason: err?.message || 'network' }
  }
}
