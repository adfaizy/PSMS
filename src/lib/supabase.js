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

/**
 * Single source of truth on globalThis so HMR / duplicate module graphs
 * still see the same configured client.
 */
function cloudState() {
  if (typeof globalThis === 'undefined') {
    return { configured: false, client: null, url: '', anonKey: '' }
  }
  if (!globalThis.__PSMS_SB__) {
    globalThis.__PSMS_SB__ = { configured: false, client: null, url: '', anonKey: '' }
  }
  return globalThis.__PSMS_SB__
}

/** Shared readiness check — must match syncLegacyExports / getters. */
function hasCloudCredentials(state) {
  return Boolean(state?.configured && state.url && state.anonKey)
}

function ensureClient(state) {
  if (hasCloudCredentials(state) && !state.client) {
    state.client = makeClient(state.url, state.anonKey)
  }
  return state.client
}

function syncLegacyExports(state) {
  ensureClient(state)
  // Same condition as getIsSupabaseConfigured()
  const ready = hasCloudCredentials(state) && Boolean(state.client)
  isSupabaseConfigured = ready
  supabase = state.client
}

export let isSupabaseConfigured = false
export let supabase = null

function applyCloud(url, anonKey) {
  const state = cloudState()
  const ok = Boolean(url && anonKey)

  // Reuse existing client when credentials unchanged (avoids HMR thrash)
  if (
    ok &&
    state.configured &&
    state.client &&
    state.url === url &&
    state.anonKey === anonKey
  ) {
    syncLegacyExports(state)
    return { ok: true, client: state.client, url: state.url }
  }

  state.configured = ok
  state.url = ok ? url : ''
  state.anonKey = ok ? anonKey : ''
  state.client = ok ? makeClient(url, anonKey) : null
  syncLegacyExports(state)
  return { ok, client: state.client, url: state.url }
}

{
  const initial = resolveCloudConfig()
  applyCloud(initial.url, initial.anonKey)
}

/** Always read from globalThis; rebuild client if credentials exist but client was dropped (HMR). */
export function getSupabase() {
  const state = cloudState()
  ensureClient(state)
  syncLegacyExports(state)
  return state.client
}

export function getIsSupabaseConfigured() {
  const state = cloudState()
  ensureClient(state)
  syncLegacyExports(state)
  return hasCloudCredentials(state) && Boolean(state.client)
}

/**
 * Load cloud settings from inline script / public JSON, then create client.
 * Never wipes a working in-memory config if fetch/env briefly return empty.
 */
export async function initSupabaseCloud() {
  const previous = cloudState()
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
      // keep prior `next` from resolveCloudConfig()
    }
  }

  // Prefer known-good globalThis credentials over empty resolve after a failed fetch
  if (!next.url || !next.anonKey) {
    if (previous.url && previous.anonKey) {
      next = { url: previous.url, anonKey: previous.anonKey }
    } else {
      next = resolveCloudConfig()
    }
  }

  if (!next.url || !next.anonKey) {
    // Do not call applyCloud('', '') — that would wipe a live session
    if (hasCloudCredentials(previous)) {
      syncLegacyExports(previous)
      return { ok: true, client: previous.client, url: previous.url }
    }
    return { ok: false, client: null, url: '' }
  }

  return applyCloud(next.url, next.anonKey)
}

/**
 * Ensure cloud client is ready before Create Login / Sign In (worldwide).
 * Prefer this over reading the exported boolean, which can be stale after HMR.
 */
export async function ensureCloudReady() {
  const init = await initSupabaseCloud()
  if (init?.ok && init?.client) return init
  await new Promise((r) => setTimeout(r, 400))
  return initSupabaseCloud()
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
