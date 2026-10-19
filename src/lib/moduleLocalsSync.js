/**
 * Sync localStorage-only module data ↔ Supabase `school_module_data`.
 * Core school/students/fees/library books already use dedicated tables.
 */

import {
  getIsSupabaseConfigured,
  loadAllSchoolModuleDataFromCloud,
  saveSchoolModuleDataToCloud,
} from '../supabaseSync.js'
import { STORAGE_KEY as DAILY_REGISTER_KEY } from '../modules/dailyRegister/dailyRegisterCore.js'
import {
  LIBRARY_RULES_KEY,
  LIBRARY_FINES_KEY,
} from '../modules/library/libraryManageCore.js'
import {
  FEE_CONCESSIONS_KEY,
  FEE_EXPENSES_KEY,
} from '../modules/fee/feeFinanceCore.js'
import { STAFF_ATTENDANCE_KEY } from '../modules/staff/staffCore.js'

export const MODULE_KEYS = {
  DAILY_REGISTER: 'daily_register',
  LIBRARY_RULES: 'library_rules',
  LIBRARY_FINES: 'library_fines',
  FEE_CONCESSIONS: 'fee_concessions',
  FEE_EXPENSES: 'fee_expenses',
  STAFF_ATTENDANCE: 'staff_attendance',
}

function readJson(key, fallback) {
  try {
    if (typeof window === 'undefined') return fallback
    const raw = window.localStorage.getItem(key)
    if (!raw) return fallback
    return JSON.parse(raw)
  } catch {
    return fallback
  }
}

function writeJson(key, value) {
  try {
    if (typeof window === 'undefined') return
    window.localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* ignore */
  }
}

function schoolSlice(map, schoolId, empty) {
  if (!map || typeof map !== 'object') return empty
  return map[schoolId] != null ? map[schoolId] : empty
}

function setSchoolSlice(storageKey, schoolId, slice) {
  const root = readJson(storageKey, {})
  const next = root && typeof root === 'object' ? { ...root } : {}
  next[schoolId] = slice
  writeJson(storageKey, next)
}

/** Daily register root is keyed by `${schoolId}__${classId}__${month}` */
function getDailyRegisterForSchool(schoolId) {
  const root = readJson(DAILY_REGISTER_KEY, {})
  const out = {}
  const prefix = `${schoolId}__`
  for (const [k, v] of Object.entries(root || {})) {
    if (k.startsWith(prefix)) out[k] = v
  }
  return out
}

function mergeDailyRegisterForSchool(schoolId, schoolSheets) {
  const root = readJson(DAILY_REGISTER_KEY, {})
  const next = root && typeof root === 'object' ? { ...root } : {}
  const prefix = `${schoolId}__`
  for (const k of Object.keys(next)) {
    if (k.startsWith(prefix)) delete next[k]
  }
  for (const [k, v] of Object.entries(schoolSheets || {})) {
    if (k.startsWith(prefix)) next[k] = v
  }
  writeJson(DAILY_REGISTER_KEY, next)
}

function collectLocalPayloads(schoolId) {
  return {
    [MODULE_KEYS.DAILY_REGISTER]: getDailyRegisterForSchool(schoolId),
    [MODULE_KEYS.LIBRARY_RULES]: schoolSlice(readJson(LIBRARY_RULES_KEY, {}), schoolId, {}),
    [MODULE_KEYS.LIBRARY_FINES]: schoolSlice(readJson(LIBRARY_FINES_KEY, {}), schoolId, []),
    [MODULE_KEYS.FEE_CONCESSIONS]: schoolSlice(readJson(FEE_CONCESSIONS_KEY, {}), schoolId, []),
    [MODULE_KEYS.FEE_EXPENSES]: schoolSlice(readJson(FEE_EXPENSES_KEY, {}), schoolId, []),
    [MODULE_KEYS.STAFF_ATTENDANCE]: schoolSlice(readJson(STAFF_ATTENDANCE_KEY, {}), schoolId, {}),
  }
}

function applyCloudPayloads(schoolId, cloudMap) {
  if (!cloudMap || typeof cloudMap !== 'object') return
  if (cloudMap[MODULE_KEYS.DAILY_REGISTER] && typeof cloudMap[MODULE_KEYS.DAILY_REGISTER] === 'object') {
    const local = getDailyRegisterForSchool(schoolId)
    const cloud = cloudMap[MODULE_KEYS.DAILY_REGISTER]
    // Prefer cloud when it has sheets; otherwise keep local
    const merged = { ...local, ...cloud }
    mergeDailyRegisterForSchool(schoolId, merged)
  }
  if (cloudMap[MODULE_KEYS.LIBRARY_RULES] && typeof cloudMap[MODULE_KEYS.LIBRARY_RULES] === 'object') {
    setSchoolSlice(LIBRARY_RULES_KEY, schoolId, cloudMap[MODULE_KEYS.LIBRARY_RULES])
  }
  // When the cloud key is present, apply it even if empty so deletions sync.
  if (Array.isArray(cloudMap[MODULE_KEYS.LIBRARY_FINES])) {
    setSchoolSlice(LIBRARY_FINES_KEY, schoolId, cloudMap[MODULE_KEYS.LIBRARY_FINES])
  }
  if (Array.isArray(cloudMap[MODULE_KEYS.FEE_CONCESSIONS])) {
    setSchoolSlice(FEE_CONCESSIONS_KEY, schoolId, cloudMap[MODULE_KEYS.FEE_CONCESSIONS])
  }
  if (Array.isArray(cloudMap[MODULE_KEYS.FEE_EXPENSES])) {
    setSchoolSlice(FEE_EXPENSES_KEY, schoolId, cloudMap[MODULE_KEYS.FEE_EXPENSES])
  }
  if (
    Object.prototype.hasOwnProperty.call(cloudMap, MODULE_KEYS.STAFF_ATTENDANCE) &&
    cloudMap[MODULE_KEYS.STAFF_ATTENDANCE] &&
    typeof cloudMap[MODULE_KEYS.STAFF_ATTENDANCE] === 'object' &&
    !Array.isArray(cloudMap[MODULE_KEYS.STAFF_ATTENDANCE])
  ) {
    setSchoolSlice(STAFF_ATTENDANCE_KEY, schoolId, cloudMap[MODULE_KEYS.STAFF_ATTENDANCE])
  }
}

/** Push all local-only module blobs for a school to Supabase. */
export async function pushModuleLocalsToCloud(schoolId) {
  if (!getIsSupabaseConfigured() || !schoolId) return { ok: false, skipped: true }
  const payloads = collectLocalPayloads(schoolId)
  const results = []
  for (const [moduleKey, payload] of Object.entries(payloads)) {
    const empty =
      payload == null ||
      (Array.isArray(payload) && payload.length === 0) ||
      (typeof payload === 'object' && !Array.isArray(payload) && Object.keys(payload).length === 0)
    // Still upsert empty objects so deletes propagate; skip only null
    if (payload == null) continue
    if (empty && moduleKey === MODULE_KEYS.DAILY_REGISTER) continue
    results.push(await saveSchoolModuleDataToCloud(schoolId, moduleKey, payload))
  }
  return { ok: results.every((r) => r?.ok !== false), results }
}

/** Pull cloud module blobs into localStorage (cloud wins when present). */
export async function hydrateModuleLocalsFromCloud(schoolId) {
  if (!getIsSupabaseConfigured() || !schoolId) return null
  const cloud = await loadAllSchoolModuleDataFromCloud(schoolId)
  if (!cloud) return null
  applyCloudPayloads(schoolId, cloud)
  return cloud
}

/** Push a single module key after a local save (fire-and-forget friendly). */
export async function pushOneModuleLocal(schoolId, moduleKey, payload) {
  if (!getIsSupabaseConfigured() || !schoolId || !moduleKey) return { ok: false, skipped: true }
  return saveSchoolModuleDataToCloud(schoolId, moduleKey, payload)
}
