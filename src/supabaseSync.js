import {
  isSupabaseConfigured,
  getSupabase,
  getIsSupabaseConfigured,
} from './lib/supabase.js'
import { migrateEntityPhotos, cloudSafePhoto } from './lib/photoStorage.js'

export { isSupabaseConfigured, getSupabase, getIsSupabaseConfigured }

// Prefer getters only — never fall back to possibly stale module bindings after HMR.

function logSyncError(scope, error) {
  if (!error) return
  console.warn(`[supabaseSync:${scope}]`, error.message || error)
}

// ─── mappers ─────────────────────────────────────────────────────────────────

function studentToRow(schoolId, s) {
  return {
    id: s.id,
    school_id: schoolId,
    class_id: s.classId || null,
    admission_no: s.admissionNo || null,
    roll_no: s.rollNo || null,
    name: s.name || '',
    father_name: s.fatherName || '',
    dob: s.dob || '',
    bay_form: s.bayForm || '',
    father_cnic: s.fatherCnic || '',
    whatsapp: s.whatsapp || '',
    // Only public HTTPS URLs — data URLs break worldwide upserts / other devices
    photo: cloudSafePhoto(s.photo),
    meta: {},
  }
}

function studentFromRow(row) {
  return {
    id: row.id,
    classId: row.class_id || '',
    admissionNo: row.admission_no || '',
    rollNo: row.roll_no || '',
    name: row.name || '',
    fatherName: row.father_name || '',
    dob: row.dob || '',
    bayForm: row.bay_form || '',
    fatherCnic: row.father_cnic || '',
    whatsapp: row.whatsapp || '',
    photo: row.photo || null,
  }
}

function staffToRow(schoolId, p) {
  return {
    id: p.id,
    school_id: schoolId,
    photo: cloudSafePhoto(p.photo),
    staff_category: p.staffCategory || null,
    cpn: p.cpn || null,
    name: p.name || null,
    fname: p.fname || null,
    cnic: p.cnic || null,
    bps: p.bps || null,
    designation: p.designation || null,
    dob: p.dob || null,
    domicile: p.domicile || null,
    aq: p.aq || null,
    subj: p.subj || null,
    pq: p.pq || null,
    doe: p.doe || null,
    dprs: p.dprs || null,
    dppp: p.dppp || null,
    daps: p.daps || null,
    contact: p.contact || null,
    email: p.email || null,
    bank_name: p.bankName || null,
    acc_no: p.accNo || null,
    iban: p.iban || null,
    bank_code: p.bankCode || null,
    branch: p.branch || null,
    address: p.address || null,
    emergency_contact: p.emergencyContact || null,
    employee_status: p.employeeStatus || null,
    department: p.department || null,
    meta: {},
  }
}

function staffFromRow(row) {
  return {
    id: row.id,
    photo: row.photo || null,
    staffCategory: row.staff_category || '',
    cpn: row.cpn || '',
    name: row.name || '',
    fname: row.fname || '',
    cnic: row.cnic || '',
    bps: row.bps || '',
    designation: row.designation || '',
    dob: row.dob || '',
    domicile: row.domicile || '',
    aq: row.aq || '',
    subj: row.subj || '',
    pq: row.pq || '',
    doe: row.doe || '',
    dprs: row.dprs || '',
    dppp: row.dppp || '',
    daps: row.daps || '',
    contact: row.contact || '',
    email: row.email || '',
    bankName: row.bank_name || '',
    accNo: row.acc_no || '',
    iban: row.iban || '',
    bankCode: row.bank_code || '',
    branch: row.branch || '',
    address: row.address || '',
    emergencyContact: row.emergency_contact || '',
    employeeStatus: row.employee_status || '',
    department: row.department || '',
  }
}

function userToRow(u) {
  return {
    id: u.id,
    email: String(u.email || '').trim().toLowerCase(),
    password_hash: u.password || '',
    school_id: u.schoolId || null,
    user_type: u.userType || 'school',
    blocked: Boolean(u.blocked),
    display_name: u.name || u.displayName || null,
    meta: {
      ...(u.meta && typeof u.meta === 'object' ? u.meta : {}),
      phone: u.phone || undefined,
      createdAt: u.createdAt || undefined,
    },
  }
}

function userFromRow(row) {
  const meta = row.meta && typeof row.meta === 'object' ? row.meta : {}
  return {
    id: row.id,
    email: row.email,
    password: row.password_hash,
    schoolId: row.school_id || null,
    userType: row.user_type || 'school',
    blocked: Boolean(row.blocked),
    name: row.display_name || '',
    phone: meta.phone || '',
    createdAt: meta.createdAt || row.created_at || null,
  }
}

function classRowsFromSettings(schoolId, settings) {
  const classes = Array.isArray(settings?.classes) ? settings.classes : []
  return classes.map((c, i) => ({
    id: c.id,
    school_id: schoolId,
    name: c.name || null,
    label: c.label || null,
    grade: c.grade || null,
    section: c.section || null,
    sort_order: i,
    meta: {},
  }))
}

// ─── schools load / save ─────────────────────────────────────────────────────

export async function loadSchoolsFromCloud() {
  if (!getIsSupabaseConfigured() || !getSupabase()) return null

  const { data: schoolRows, error } = await getSupabase()
    .from('schools')
    .select('*')
    .neq('status', 'deleted')
    .order('created_at', { ascending: true })

  if (error) {
    logSyncError('loadSchools', error)
    return null
  }
  if (!schoolRows?.length) return { schools: [], activeSchoolId: null }

  const schoolIds = schoolRows.map((s) => s.id)

  const [
    studentsRes,
    staffRes,
    examRes,
    transferRes,
    retiredRes,
  ] = await Promise.all([
    getSupabase().from('students').select('*').in('school_id', schoolIds),
    getSupabase().from('staff_profiles').select('*').in('school_id', schoolIds),
    getSupabase().from('exam_sessions').select('*').in('school_id', schoolIds),
    getSupabase().from('staff_transfer_history').select('*').in('school_id', schoolIds),
    getSupabase().from('retired_staff').select('*').in('school_id', schoolIds),
  ])

  for (const [label, res] of [
    ['students', studentsRes],
    ['staff', staffRes],
    ['exam', examRes],
    ['transfer', transferRes],
    ['retired', retiredRes],
  ]) {
    if (res.error) logSyncError(`load:${label}`, res.error)
  }

  const studentsBySchool = groupBy(studentsRes.data || [], 'school_id')
  const staffBySchool = groupBy(staffRes.data || [], 'school_id')
  const examsBySchool = groupBy(examRes.data || [], 'school_id')
  const transfersBySchool = groupBy(transferRes.data || [], 'school_id')
  const retiredBySchool = groupBy(retiredRes.data || [], 'school_id')

  const schools = schoolRows.map((row) => {
    const examRows = examsBySchool[row.id] || []
    const exam_by_session = {}
    for (const ex of examRows) {
      exam_by_session[ex.session_label] = {
        exam_tm: ex.exam_tm || {},
        exam_om: ex.exam_om || {},
        exam_datesheet: ex.exam_datesheet || { dates: [], cols: [], subs: {}, note: '' },
      }
    }
    const currentSession = row.current_session || Object.keys(exam_by_session)[0] || null
    const sessionData = currentSession ? exam_by_session[currentSession] : null

    return {
      id: row.id,
      name: row.name || 'School',
      status: row.status || 'active',
      settings: row.settings && typeof row.settings === 'object' ? row.settings : {},
      timetable: row.timetable && typeof row.timetable === 'object' ? row.timetable : {},
      questionBank: row.question_bank && typeof row.question_bank === 'object' ? row.question_bank : {},
      currentSession,
      sessions: Array.isArray(row.sessions) ? row.sessions : (currentSession ? [currentSession] : []),
      exam_by_session,
      exam_tm: sessionData?.exam_tm || {},
      exam_om: sessionData?.exam_om || {},
      exam_datesheet: sessionData?.exam_datesheet || { dates: [], cols: [], subs: {}, note: '' },
      students: (studentsBySchool[row.id] || []).map(studentFromRow),
      staffProfiles: (staffBySchool[row.id] || []).map(staffFromRow),
      staffTransferHistory: (transfersBySchool[row.id] || []).map((t) => t.payload || t),
      retiredStaff: (retiredBySchool[row.id] || []).map((t) => t.payload || t),
    }
  })

  let activeSchoolId = null
  try {
    activeSchoolId = window.localStorage.getItem('activeSchoolId')
  } catch { /* ignore */ }
  if (!activeSchoolId || !schools.some((s) => s.id === activeSchoolId)) {
    activeSchoolId = schools[0]?.id || null
  }

  return { schools, activeSchoolId }
}

export async function saveSchoolsToCloud(schools, activeSchoolId) {
  if (!getIsSupabaseConfigured() || !getSupabase()) return { ok: false, skipped: true }
  const list = Array.isArray(schools) ? schools : []
  if (!list.length) return { ok: true, schools: list }

  const migratedSchools = []
  try {
    for (const school of list) {
      const schoolRow = {
        id: school.id,
        name: school.name || 'School',
        status: school.status === 'stopped' || school.status === 'deleted' ? school.status : 'active',
        current_session: school.currentSession || null,
        sessions: Array.isArray(school.sessions) ? school.sessions : [],
        settings: school.settings || {},
        timetable: school.timetable || {},
        question_bank: school.questionBank || {},
      }

      const { error: schoolErr } = await getSupabase().from('schools').upsert(schoolRow)
      if (schoolErr) {
        logSyncError('upsertSchool', schoolErr)
        migratedSchools.push(school)
        continue
      }

      // classes
      const classRows = classRowsFromSettings(school.id, school.settings)
      if (classRows.length) {
        const { error } = await getSupabase().from('classes').upsert(classRows)
        if (error) logSyncError('upsertClasses', error)
      }

      // Upload data-URL photos to public Storage so every device can load them
      let students = await migrateEntityPhotos(school.id, school.students || [], 'students', 40)
      let staffProfiles = await migrateEntityPhotos(school.id, school.staffProfiles || [], 'staff', 20)
      // Second pass if many photos remain (keeps payload small for worldwide sync)
      const stillData = (list) => (list || []).some((e) => String(e?.photo || '').startsWith('data:image'))
      if (stillData(students)) students = await migrateEntityPhotos(school.id, students, 'students', 40)
      if (stillData(staffProfiles)) staffProfiles = await migrateEntityPhotos(school.id, staffProfiles, 'staff', 20)
      const nextSchool = { ...school, students, staffProfiles }
      migratedSchools.push(nextSchool)
      await replaceChildren('students', school.id, students.map((s) => studentToRow(school.id, s)))
      await replaceChildren('staff_profiles', school.id, staffProfiles.map((p) => staffToRow(school.id, p)))

      // exam sessions
      const bySession = school.exam_by_session && typeof school.exam_by_session === 'object'
        ? school.exam_by_session
        : {}
      const examRows = Object.entries(bySession).map(([label, data]) => ({
        school_id: school.id,
        session_label: label,
        exam_tm: data?.exam_tm || {},
        exam_om: data?.exam_om || {},
        exam_datesheet: data?.exam_datesheet || { dates: [], cols: [], subs: {}, note: '' },
      }))
      if (examRows.length) {
        const { error } = await getSupabase()
          .from('exam_sessions')
          .upsert(examRows, { onConflict: 'school_id,session_label' })
        if (error) logSyncError('upsertExamSessions', error)
      }

      // transfer / retired history (payload blobs)
      const transfers = (school.staffTransferHistory || []).map((payload, i) => ({
        id: payload?.id || `${school.id}-transfer-${i}`,
        school_id: school.id,
        staff_id: payload?.id || payload?.staffId || null,
        payload,
      }))
      if (transfers.length) {
        const { error } = await getSupabase().from('staff_transfer_history').upsert(transfers)
        if (error) logSyncError('upsertTransfers', error)
      }

      const retired = (school.retiredStaff || []).map((payload, i) => ({
        id: payload?.id || `${school.id}-retired-${i}`,
        school_id: school.id,
        staff_id: payload?.id || payload?.staffId || null,
        payload,
      }))
      if (retired.length) {
        const { error } = await getSupabase().from('retired_staff').upsert(retired)
        if (error) logSyncError('upsertRetired', error)
      }
    }

    if (activeSchoolId) {
      try { window.localStorage.setItem('activeSchoolId', activeSchoolId) } catch { /* ignore */ }
    }

    return { ok: true, schools: migratedSchools.length ? migratedSchools : list }
  } catch (err) {
    logSyncError('saveSchools', err)
    return { ok: false, error: err, schools: migratedSchools.length ? migratedSchools : list }
  }
}

async function replaceChildren(table, schoolId, rows) {
  const { data: existing, error: listErr } = await getSupabase()
    .from(table)
    .select('id')
    .eq('school_id', schoolId)
  if (listErr) {
    logSyncError(`list:${table}`, listErr)
    return
  }

  const nextIds = new Set(rows.map((r) => r.id))
  const toDelete = (existing || []).map((r) => r.id).filter((id) => !nextIds.has(id))
  if (toDelete.length) {
    const { error } = await getSupabase().from(table).delete().in('id', toDelete)
    if (error) logSyncError(`delete:${table}`, error)
  }
  if (rows.length) {
    const { error } = await getSupabase().from(table).upsert(rows)
    if (error) logSyncError(`upsert:${table}`, error)
  }
}

function groupBy(rows, key) {
  const map = {}
  for (const row of rows) {
    const k = row[key]
    if (!map[k]) map[k] = []
    map[k].push(row)
  }
  return map
}

// ─── auth users ──────────────────────────────────────────────────────────────

export async function loadAuthUsersFromCloud() {
  if (!getIsSupabaseConfigured() || !getSupabase()) return null
  const { data, error } = await getSupabase().from('app_users').select('*').order('created_at', { ascending: true })
  if (error) {
    logSyncError('loadAuthUsers', error)
    return null
  }
  return (data || []).map(userFromRow)
}

/** Direct cloud lookup by email — used by Sign In so other devices do not depend on localStorage. */
export async function findAuthUserByEmailFromCloud(email) {
  if (!getIsSupabaseConfigured() || !getSupabase()) return null
  const emailNorm = String(email || '').trim().toLowerCase()
  if (!emailNorm) return null
  try {
    // Exact match first (emails are stored lowercased)
    let { data, error } = await getSupabase()
      .from('app_users')
      .select('*')
      .eq('email', emailNorm)
      .limit(1)
      .maybeSingle()
    if (error || !data) {
      const loose = await getSupabase()
        .from('app_users')
        .select('*')
        .ilike('email', emailNorm)
        .limit(1)
        .maybeSingle()
      data = loose.data
      error = loose.error
    }
    if (error) {
      logSyncError('findAuthUserByEmail', error)
      const all = await loadAuthUsersFromCloud()
      return (all || []).find((u) => String(u.email || '').toLowerCase() === emailNorm) || null
    }
    return data ? userFromRow(data) : null
  } catch (err) {
    logSyncError('findAuthUserByEmail', err)
    try {
      const all = await loadAuthUsersFromCloud()
      return (all || []).find((u) => String(u.email || '').toLowerCase() === emailNorm) || null
    } catch {
      return null
    }
  }
}

/** Upsert a single auth user to cloud (safe for multi-device Create Login). */
export async function upsertAuthUserToCloud(user) {
  if (!getIsSupabaseConfigured() || !getSupabase() || !user?.id) return { ok: false, skipped: true }
  try {
    const { error } = await getSupabase().from('app_users').upsert(userToRow(user))
    if (error) {
      logSyncError('upsertAuthUser', error)
      return { ok: false, error }
    }
    return { ok: true }
  } catch (err) {
    logSyncError('upsertAuthUser', err)
    return { ok: false, error: err }
  }
}

/**
 * Upsert auth users to cloud.
 * By default NEVER deletes other cloud accounts (safe for multi-device).
 * Pass { replace: true } only for intentional full wipe (admin reset).
 */
export async function saveAuthUsersToCloud(users, { replace = false } = {}) {
  if (!getIsSupabaseConfigured() || !getSupabase()) return { ok: false, skipped: true }
  const list = Array.isArray(users) ? users : []
  try {
    if (replace) {
      const { data: existing } = await getSupabase().from('app_users').select('id')
      const nextIds = new Set(list.map((u) => u.id))
      const toDelete = (existing || []).map((u) => u.id).filter((id) => !nextIds.has(id))
      if (toDelete.length) {
        const { error: delErr } = await getSupabase().from('app_users').delete().in('id', toDelete)
        if (delErr) {
          logSyncError('saveAuthUsers:delete', delErr)
          return { ok: false, error: delErr }
        }
      }
    }
    if (list.length) {
      const { error } = await getSupabase().from('app_users').upsert(list.map(userToRow))
      if (error) {
        logSyncError('saveAuthUsers', error)
        return { ok: false, error }
      }
    }
    return { ok: true }
  } catch (err) {
    logSyncError('saveAuthUsers', err)
    return { ok: false, error: err }
  }
}

/** Delete specific auth users from cloud (explicit admin remove only). */
export async function deleteAuthUsersFromCloud(ids) {
  if (!getIsSupabaseConfigured() || !getSupabase()) return { ok: false, skipped: true }
  const list = (Array.isArray(ids) ? ids : []).filter(Boolean)
  if (!list.length) return { ok: true }
  try {
    const { error } = await getSupabase().from('app_users').delete().in('id', list)
    if (error) {
      logSyncError('deleteAuthUsers', error)
      return { ok: false, error }
    }
    return { ok: true }
  } catch (err) {
    logSyncError('deleteAuthUsers', err)
    return { ok: false, error: err }
  }
}

/** Wipe all PSMS application tables in Supabase (destructive). */
export async function clearAllCloudData() {
  if (!getIsSupabaseConfigured() || !getSupabase()) return { ok: false, skipped: true }
  const tables = [
    'library_borrowings',
    'library_books',
    'attendance_records',
    'fee_records',
    'exam_sessions',
    'staff_transfer_history',
    'retired_staff',
    'staff_profiles',
    'students',
    'classes',
    'discussion_messages',
    'app_users',
    'schools',
  ]
  try {
    for (const table of tables) {
      const { error } = await getSupabase().from(table).delete().neq('id', '')
      if (error) logSyncError(`clear:${table}`, error)
    }
    return { ok: true }
  } catch (err) {
    logSyncError('clearAllCloudData', err)
    return { ok: false, error: err }
  }
}

// ─── attendance ──────────────────────────────────────────────────────────────

export async function loadAttendanceFromCloud(schoolId) {
  if (!getIsSupabaseConfigured() || !getSupabase() || !schoolId) return null
  const { data, error } = await getSupabase()
    .from('attendance_records')
    .select('*')
    .eq('school_id', schoolId)
  if (error) {
    logSyncError('loadAttendance', error)
    return null
  }
  const att = {}
  for (const row of data || []) {
    const key = `${row.class_id}_${row.attendance_date}`
    if (!att[key]) att[key] = {}
    att[key][row.student_id] = row.status
  }
  return att
}

export async function saveAttendanceToCloud(schoolId, att) {
  if (!getIsSupabaseConfigured() || !getSupabase() || !schoolId) return { ok: false, skipped: true }
  const rows = []
  for (const [key, statuses] of Object.entries(att || {})) {
    const idx = key.lastIndexOf('_')
    if (idx < 0) continue
    const classId = key.slice(0, idx)
    const date = key.slice(idx + 1)
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue
    for (const [studentId, status] of Object.entries(statuses || {})) {
      if (!['P', 'A', 'L'].includes(status)) continue
      rows.push({
        school_id: schoolId,
        class_id: classId,
        attendance_date: date,
        student_id: studentId,
        status,
      })
    }
  }

  try {
    await getSupabase().from('attendance_records').delete().eq('school_id', schoolId)
    if (rows.length) {
      const { error } = await getSupabase().from('attendance_records').upsert(rows, {
        onConflict: 'school_id,class_id,attendance_date,student_id',
      })
      if (error) {
        logSyncError('saveAttendance', error)
        return { ok: false, error }
      }
    }
    return { ok: true }
  } catch (err) {
    logSyncError('saveAttendance', err)
    return { ok: false, error: err }
  }
}

// ─── fees ────────────────────────────────────────────────────────────────────

export async function loadFeesFromCloud(schoolId) {
  if (!getIsSupabaseConfigured() || !getSupabase() || !schoolId) return null
  const { data, error } = await getSupabase().from('fee_records').select('*').eq('school_id', schoolId)
  if (error) {
    logSyncError('loadFees', error)
    return null
  }
  return (data || []).map((row) => ({
    id: row.id,
    classId: row.class_id,
    studentId: row.student_id,
    month: row.month,
    year: row.year,
    amount: Number(row.amount) || 20,
    paidAt: row.paid_at,
  }))
}

export async function saveFeesToCloud(schoolId, feeRecords) {
  if (!getIsSupabaseConfigured() || !getSupabase() || !schoolId) return { ok: false, skipped: true }
  // Stable ids + orphan-only delete (never wipe whole school — that broke worldwide sync).
  const rows = (feeRecords || [])
    .filter((rec) => rec?.studentId && rec?.classId && rec?.month && rec?.year)
    .map((rec) => {
      const month = Number(rec.month)
      const year = Number(rec.year)
      const classId = String(rec.classId)
      const studentId = String(rec.studentId)
      return {
        id: `${schoolId}_${classId}_${studentId}_${month}_${year}`,
        school_id: schoolId,
        class_id: classId,
        student_id: studentId,
        month,
        year,
        amount: Number(rec.amount) || 20,
        paid_at: rec.paidAt || new Date().toISOString(),
        meta: {},
      }
    })
  try {
    const { data: existing, error: listErr } = await getSupabase()
      .from('fee_records')
      .select('id')
      .eq('school_id', schoolId)
    if (listErr) {
      logSyncError('saveFees:list', listErr)
      return { ok: false, error: listErr }
    }
    const nextIds = new Set(rows.map((r) => r.id))
    const toDelete = (existing || []).map((r) => r.id).filter((id) => !nextIds.has(id))
    if (toDelete.length) {
      const { error: delErr } = await getSupabase().from('fee_records').delete().in('id', toDelete)
      if (delErr) {
        logSyncError('saveFees:delete', delErr)
        return { ok: false, error: delErr }
      }
    }
    if (rows.length) {
      // onConflict must list columns of a real UNIQUE/PK constraint.
      // Use primary key `id` (always present). Stable composite ids above + orphan
      // delete keep one row per fee; schema also has UNIQUE(school_id,class_id,student_id,month,year).
      let { error } = await getSupabase().from('fee_records').upsert(rows, {
        onConflict: 'id',
      })
      if (error) {
        // Fallback for DBs where callers expect the composite unique target.
        const retry = await getSupabase().from('fee_records').upsert(rows, {
          onConflict: 'school_id,class_id,student_id,month,year',
        })
        error = retry.error
      }
      if (error) {
        logSyncError('saveFees', error)
        return { ok: false, error }
      }
    }
    return { ok: true }
  } catch (err) {
    logSyncError('saveFees', err)
    return { ok: false, error: err }
  }
}

// ─── library ─────────────────────────────────────────────────────────────────

export async function loadLibraryFromCloud(schoolId) {
  if (!getIsSupabaseConfigured() || !getSupabase() || !schoolId) return null
  const [booksRes, borrowRes] = await Promise.all([
    getSupabase().from('library_books').select('*').eq('school_id', schoolId),
    getSupabase().from('library_borrowings').select('*').eq('school_id', schoolId),
  ])
  if (booksRes.error) {
    logSyncError('loadLibraryBooks', booksRes.error)
    return null
  }
  if (borrowRes.error) logSyncError('loadLibraryBorrowings', borrowRes.error)

  return {
    books: (booksRes.data || []).map((b) => ({
      id: b.id,
      title: b.title,
      author: b.author,
      copies: b.copies,
      addedAt: b.added_at,
      ...(b.meta && typeof b.meta === 'object' ? b.meta : {}),
    })),
    borrowings: (borrowRes.data || []).map((b) => ({
      id: b.id,
      bookId: b.book_id,
      studentId: b.student_id,
      borrowerName: b.borrower_name,
      issuedAt: b.issued_at,
      returnedAt: b.returned_at,
      ...(b.meta && typeof b.meta === 'object' ? b.meta : {}),
    })),
  }
}

export async function saveLibraryToCloud(schoolId, libraryData) {
  if (!getIsSupabaseConfigured() || !getSupabase() || !schoolId) return { ok: false, skipped: true }
  const books = (libraryData?.books || []).map((b) => {
    const { id, title, author, copies, addedAt, ...meta } = b
    return {
      id,
      school_id: schoolId,
      title: title || null,
      author: author || null,
      copies: copies ?? 1,
      added_at: addedAt || new Date().toISOString(),
      meta,
    }
  })
  const borrowings = (libraryData?.borrowings || []).map((b) => {
    const { id, bookId, studentId, borrowerName, issuedAt, returnedAt, ...meta } = b
    return {
      id,
      school_id: schoolId,
      book_id: bookId,
      student_id: studentId || null,
      borrower_name: borrowerName || null,
      issued_at: issuedAt || new Date().toISOString(),
      returned_at: returnedAt || null,
      meta,
    }
  })

  try {
    await getSupabase().from('library_borrowings').delete().eq('school_id', schoolId)
    await getSupabase().from('library_books').delete().eq('school_id', schoolId)
    if (books.length) {
      const { error } = await getSupabase().from('library_books').upsert(books)
      if (error) logSyncError('saveLibraryBooks', error)
    }
    if (borrowings.length) {
      const { error } = await getSupabase().from('library_borrowings').upsert(borrowings)
      if (error) logSyncError('saveLibraryBorrowings', error)
    }
    return { ok: true }
  } catch (err) {
    logSyncError('saveLibrary', err)
    return { ok: false, error: err }
  }
}

// ─── discussion ──────────────────────────────────────────────────────────────

export async function loadDiscussionFromCloud() {
  if (!getIsSupabaseConfigured() || !getSupabase()) return null
  const { data, error } = await getSupabase()
    .from('discussion_messages')
    .select('*')
    .order('created_at', { ascending: true })
  if (error) {
    logSyncError('loadDiscussion', error)
    return null
  }
  return (data || []).map((m) => {
    const meta = m.meta && typeof m.meta === 'object' ? m.meta : {}
    const createdAt = meta.createdAt
      ?? (m.created_at ? new Date(m.created_at).getTime() : Date.now())
    return {
      id: m.id,
      parentId: meta.parentId ?? null,
      role: meta.role || 'client',
      authorName: meta.authorName || m.author || 'Guest',
      body: m.body || '',
      createdAt: typeof createdAt === 'number' ? createdAt : new Date(createdAt).getTime(),
    }
  })
}

export async function saveDiscussionToCloud(messages) {
  if (!getIsSupabaseConfigured() || !getSupabase()) return { ok: false, skipped: true }
  const rows = (messages || []).map((m) => {
    const createdAtMs = typeof m.createdAt === 'number' ? m.createdAt : Date.now()
    return {
      id: m.id,
      author: m.authorName || m.author || null,
      body: m.body || '',
      created_at: new Date(createdAtMs).toISOString(),
      meta: {
        parentId: m.parentId || null,
        role: m.role || 'client',
        authorName: m.authorName || m.author || 'Guest',
        createdAt: createdAtMs,
      },
    }
  })
  try {
    const { data: existing } = await getSupabase().from('discussion_messages').select('id')
    const nextIds = new Set(rows.map((r) => r.id).filter(Boolean))
    const toDelete = (existing || []).map((r) => r.id).filter((id) => !nextIds.has(id))
    if (toDelete.length) await getSupabase().from('discussion_messages').delete().in('id', toDelete)
    if (rows.length) {
      const { error } = await getSupabase().from('discussion_messages').upsert(rows)
      if (error) {
        logSyncError('saveDiscussion', error)
        return { ok: false, error }
      }
    }
    return { ok: true }
  } catch (err) {
    logSyncError('saveDiscussion', err)
    return { ok: false, error: err }
  }
}
