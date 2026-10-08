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
  // Prefer runtime/public config first so every browser hitting this app gets Cloud ON,
  // even when Vite env was not baked into that client's bundle.
  const runtime = readRuntimeCloud()
  const fromEnvUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const fromEnvKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  return {
    url: runtime.url || fromEnvUrl || '',
    anonKey: runtime.anonKey || fromEnvKey || '',
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
  return Boolean(state?.url && state.anonKey)
}

function ensureClient(state) {
  if (hasCloudCredentials(state) && !state.client) {
    state.configured = true
    state.client = makeClient(state.url, state.anonKey)
  }
  return state.client
}

function syncLegacyExports(state) {
  ensureClient(state)
  const ready = hasCloudCredentials(state) && Boolean(state.client)
  state.configured = ready
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
    state.client &&
    state.url === url &&
    state.anonKey === anonKey
  ) {
    state.configured = true
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
  if (initial.url && initial.anonKey) applyCloud(initial.url, initial.anonKey)
}

/** Always read from globalThis; rebuild client if credentials exist but client was dropped (HMR). */
export function getSupabase() {
  const state = cloudState()
  // Re-read window in case inline script arrived after first module eval
  if (!hasCloudCredentials(state)) {
    const runtime = readRuntimeCloud()
    if (runtime.url && runtime.anonKey) applyCloud(runtime.url, runtime.anonKey)
  }
  ensureClient(state)
  syncLegacyExports(state)
  return cloudState().client
}

export function getIsSupabaseConfigured() {
  const state = cloudState()
  if (!hasCloudCredentials(state)) {
    const runtime = readRuntimeCloud()
    if (runtime.url && runtime.anonKey) applyCloud(runtime.url, runtime.anonKey)
  }
  ensureClient(cloudState())
  syncLegacyExports(cloudState())
  return hasCloudCredentials(cloudState()) && Boolean(cloudState().client)
}

/**
 * Load cloud settings from inline script / public JSON, then create client.
 * Never wipes a working in-memory config if fetch/env briefly return empty.
 */
export async function initSupabaseCloud() {
  const previous = { ...cloudState() }
  let next = resolveCloudConfig()

  if (typeof window !== 'undefined') {
    // Re-check inline / script tag config (covers late HMR)
    const runtime = readRuntimeCloud()
    if (runtime.url && runtime.anonKey) next = runtime

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
      // keep prior `next`
    }
  }

  if (!next.url || !next.anonKey) {
    if (previous.url && previous.anonKey) {
      next = { url: previous.url, anonKey: previous.anonKey }
    } else {
      next = resolveCloudConfig()
    }
  }

  if (!next.url || !next.anonKey) {
    if (previous.url && previous.anonKey) {
      return applyCloud(previous.url, previous.anonKey)
    }
    return { ok: false, client: null, url: '' }
  }

  return applyCloud(next.url, next.anonKey)
}

/**
 * Ensure cloud client is ready before Create Login / Sign In (worldwide).
 */
export async function ensureCloudReady() {
  let init = await initSupabaseCloud()
  if (init?.ok && init?.client) return init
  await new Promise((r) => setTimeout(r, 300))
  init = await initSupabaseCloud()
  if (init?.ok && init?.client) return init
  // Last resort: env-only
  const envUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim()
  const envKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim()
  if (envUrl && envKey) return applyCloud(envUrl, envKey)
  return init
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
