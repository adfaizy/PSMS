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

/** Single mutable store — avoids stale module binding across browsers/HMR. */
function cloudState() {
  if (typeof globalThis !== 'undefined') {
    if (!globalThis.__PSMS_SB__) {
      globalThis.__PSMS_SB__ = { configured: false, client: null, url: '' }
    }
    return globalThis.__PSMS_SB__
  }
  return { configured: false, client: null, url: '' }
}

export let isSupabaseConfigured = false
export let supabase = null

function applyCloud(url, anonKey) {
  const state = cloudState()
  const ok = Boolean(url && anonKey)
  state.configured = ok
  state.url = ok ? url : ''
  state.client = ok ? makeClient(url, anonKey) : null
  isSupabaseConfigured = ok
  supabase = state.client
  return { ok, client: state.client, url: state.url }
}

{
  const initial = resolveCloudConfig()
  applyCloud(initial.url, initial.anonKey)
}

export function getSupabase() {
  return cloudState().client
}

export function getIsSupabaseConfigured() {
  return cloudState().configured
}

/**
 * Load cloud settings from inline script / public JSON, then create client.
 * Returns { ok, client } — Admin must use this return value (not stale imports).
 */
export async function initSupabaseCloud() {
  let next = resolveCloudConfig()

  if (typeof window !== 'undefined') {
    try {
      const base = (import.meta.env.BASE_URL || '/').replace(/\/?$/, '/')
      const res = await fetch(`${base}psms-config.json?t=${Date.now()}`, { cache: 'no-store' })
      if (res.ok) {
        const json = await res.json()
        const url = String(json.url || json.supabaseUrl || '').trim()
        const anonKey = String(json.anonKey || json.supabaseAnonKey || '').trim()
        if (url && anonKey) {
          next = { url, anonKey }
          window.__PSMS_CLOUD__ = next
        }
      }
    } catch {
      // keep prior next
    }
  }

  if (!next.url || !next.anonKey) {
    next = resolveCloudConfig()
  }

  return applyCloud(next.url, next.anonKey)
}

/** Quick connectivity check used by Admin Cloud badge. */
export async function pingSupabaseCloud(timeoutMs = 8000) {
  const client = getSupabase()
  if (!getIsSupabaseConfigured() || !client) return { ok: false, reason: 'not_configured' }
  try {
    const result = await Promise.race([
      client.from('app_users').select('id', { count: 'exact', head: true }),
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
