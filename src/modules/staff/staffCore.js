export const STAFF_TABS = [
  { id: 'directory', l: 'Directory' },
  { id: 'attendance', l: 'Attendance' },
  { id: 'leave', l: 'Leave' },
  { id: 'assignments', l: 'Assignments' },
  { id: 'transfers', l: 'Transfers' },
  { id: 'retired', l: 'Retired' },
  { id: 'documents', l: 'Documents' },
]

/** Local copy — keep staffCore free of helpers circular imports. */
function normalizeStaffCategory(value) {
  const v = String(value || '')
    .trim()
    .toLowerCase()
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
  if (!v) return 'Teaching'
  const compact = v.replace(/\s+/g, '')
  if (
    compact === 'nonteaching' ||
    compact.startsWith('nonteaching') ||
    v.includes('non teaching') ||
    v.includes('worker') ||
    v.includes('clerk') ||
    v.includes('peon') ||
    v.includes('support')
  ) {
    return 'Non Teaching'
  }
  return 'Teaching'
}

export const STAFF_ATTENDANCE_STATUS = {
  PRESENT: 'P',
  ABSENT: 'A',
  LEAVE: 'L',
  HOLIDAY: 'H',
}

export const STAFF_ATTENDANCE_LABELS = {
  P: 'Present',
  A: 'Absent',
  L: 'Leave',
  H: 'Holiday',
}

export const LEAVE_TYPES = ['Casual', 'Medical', 'Earned', 'Maternity', 'Unpaid', 'Other']

export const LEAVE_STATUS = {
  PENDING: 'pending',
  APPROVED: 'approved',
  REJECTED: 'rejected',
  CANCELLED: 'cancelled',
}

export const LEAVE_STATUS_LABELS = {
  pending: 'Pending',
  approved: 'Approved',
  rejected: 'Rejected',
  cancelled: 'Cancelled',
}

export const STAFF_ATTENDANCE_KEY = 'system_management_staff_attendance'

function newId() {
  return `staff_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function getStaffCategory(profile) {
  return normalizeStaffCategory(profile?.staffCategory)
}

export function isActiveStaff(profile) {
  const status = String(profile?.employeeStatus || 'Active').trim().toLowerCase()
  return !status || status === 'active' || status === 'on leave'
}

export function searchStaffProfiles({ profiles, query, category = 'all', statusMode = 'active' } = {}) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
  let list = Array.isArray(profiles) ? profiles : []
  if (category && category !== 'all') {
    list = list.filter((p) => getStaffCategory(p) === category)
  }
  if (statusMode === 'active') list = list.filter(isActiveStaff)
  if (!q) return list
  return list.filter((p) => {
    const hay = [
      p.name,
      p.fname,
      p.cpn,
      p.cnic,
      p.designation,
      p.subj,
      p.contact,
      p.email,
      p.department,
      getStaffCategory(p),
      p.employeeStatus,
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    return hay.includes(q)
  })
}

export function summarizeStaffDirectory(profiles, retiredStaff = []) {
  const list = Array.isArray(profiles) ? profiles : []
  const teaching = list.filter((p) => getStaffCategory(p) === 'Teaching').length
  const nonTeaching = list.filter((p) => getStaffCategory(p) === 'Non Teaching').length
  const onLeave = list.filter((p) => String(p?.employeeStatus || '').toLowerCase() === 'on leave').length
  return {
    total: list.length,
    teaching,
    nonTeaching,
    onLeave,
    retired: Array.isArray(retiredStaff) ? retiredStaff.length : 0,
  }
}

export function loadStaffAttendanceFromLocal(schoolId) {
  try {
    if (typeof window === 'undefined' || !schoolId) return {}
    const raw = window.localStorage.getItem(STAFF_ATTENDANCE_KEY)
    if (!raw) return {}
    const data = JSON.parse(raw)
    return data[schoolId] && typeof data[schoolId] === 'object' ? data[schoolId] : {}
  } catch {
    return {}
  }
}

export function saveStaffAttendanceToLocal(schoolId, att) {
  try {
    if (typeof window === 'undefined' || !schoolId) return
    const raw = window.localStorage.getItem(STAFF_ATTENDANCE_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[schoolId] = att && typeof att === 'object' ? att : {}
    window.localStorage.setItem(STAFF_ATTENDANCE_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function markStaffAttendance(att, date, staffId, status) {
  const next = { ...(att && typeof att === 'object' ? att : {}) }
  const day = { ...(next[date] && typeof next[date] === 'object' ? next[date] : {}) }
  if (!status) delete day[staffId]
  else day[staffId] = status
  next[date] = day
  return next
}

export function markAllStaffAttendance(att, date, staffIds, status) {
  let next = att && typeof att === 'object' ? att : {}
  ;(staffIds || []).forEach((id) => {
    next = markStaffAttendance(next, date, id, status)
  })
  return next
}

export function summarizeStaffAttendanceDay(att, date, staffIds) {
  const day = att?.[date] && typeof att[date] === 'object' ? att[date] : {}
  const ids = Array.isArray(staffIds) ? staffIds : []
  let present = 0
  let absent = 0
  let leave = 0
  let holiday = 0
  let unmarked = 0
  ids.forEach((id) => {
    const s = day[id]
    if (s === 'P') present += 1
    else if (s === 'A') absent += 1
    else if (s === 'L') leave += 1
    else if (s === 'H') holiday += 1
    else unmarked += 1
  })
  return { present, absent, leave, holiday, unmarked, total: ids.length }
}

export function addStaffLeaveRecord(profile, { type, fromDate, toDate, reason, status }) {
  const entry = {
    id: newId(),
    type: String(type || LEAVE_TYPES[0]).trim() || LEAVE_TYPES[0],
    fromDate: String(fromDate || '').trim(),
    toDate: String(toDate || fromDate || '').trim(),
    reason: String(reason || '').trim(),
    status: LEAVE_STATUS_LABELS[status] ? status : LEAVE_STATUS.PENDING,
    createdAt: new Date().toISOString(),
  }
  if (!entry.fromDate) return profile
  const prev = Array.isArray(profile?.leaveRecords) ? profile.leaveRecords : []
  const nextStatus =
    entry.status === LEAVE_STATUS.APPROVED ? 'On Leave' : profile?.employeeStatus || 'Active'
  return {
    ...profile,
    leaveRecords: [entry, ...prev],
    employeeStatus: nextStatus,
  }
}

export function updateStaffLeaveStatus(profile, leaveId, status) {
  const prev = Array.isArray(profile?.leaveRecords) ? profile.leaveRecords : []
  const leaveRecords = prev.map((r) => (r.id === leaveId ? { ...r, status, updatedAt: new Date().toISOString() } : r))
  const hasApproved = leaveRecords.some((r) => r.status === LEAVE_STATUS.APPROVED)
  return {
    ...profile,
    leaveRecords,
    employeeStatus: hasApproved ? 'On Leave' : profile?.employeeStatus === 'On Leave' ? 'Active' : profile?.employeeStatus || 'Active',
  }
}

export function removeStaffLeaveRecord(profile, leaveId) {
  const prev = Array.isArray(profile?.leaveRecords) ? profile.leaveRecords : []
  const leaveRecords = prev.filter((r) => r.id !== leaveId)
  const hasApproved = leaveRecords.some((r) => r.status === LEAVE_STATUS.APPROVED)
  return {
    ...profile,
    leaveRecords,
    employeeStatus: hasApproved ? 'On Leave' : profile?.employeeStatus === 'On Leave' ? 'Active' : profile?.employeeStatus || 'Active',
  }
}

export function addStaffDocument(profile, { name, docType, dataUrl, mime }) {
  const entry = {
    id: newId(),
    name: String(name || 'Document').trim() || 'Document',
    docType: String(docType || 'Other').trim() || 'Other',
    dataUrl: dataUrl || null,
    mime: mime || '',
    uploadedAt: new Date().toISOString(),
  }
  const prev = Array.isArray(profile?.documents) ? profile.documents : []
  return { ...profile, documents: [entry, ...prev] }
}

export function removeStaffDocument(profile, docId) {
  const prev = Array.isArray(profile?.documents) ? profile.documents : []
  return { ...profile, documents: prev.filter((d) => d.id !== docId) }
}

export function buildStaffAssignments(profiles, commonTeachers = {}) {
  const teaching = (Array.isArray(profiles) ? profiles : []).filter((p) => getStaffCategory(p) === 'Teaching')
  const commonRows = []
  Object.entries(commonTeachers || {}).forEach(([grade, subjects]) => {
    if (!subjects || typeof subjects !== 'object') return
    Object.entries(subjects).forEach(([subject, teacherName]) => {
      if (!teacherName) return
      commonRows.push({
        id: `common_${grade}_${subject}`,
        grade,
        subject,
        teacherName: String(teacherName),
        source: 'common',
      })
    })
  })
  const profileRows = teaching.map((p) => ({
    id: p.id,
    name: p.name || 'Teacher',
    subject: p.subj || '—',
    designation: p.designation || '—',
    cpn: p.cpn || '—',
    source: 'profile',
  }))
  return { profileRows, commonRows }
}

export function restoreRetiredStaff(retiredStaff, staffProfiles, retiredId) {
  const retired = Array.isArray(retiredStaff) ? retiredStaff : []
  const active = Array.isArray(staffProfiles) ? staffProfiles : []
  const hit = retired.find((r) => r.id === retiredId)
  if (!hit) return { retiredStaff: retired, staffProfiles: active }
  const { retiredAt: _retiredAt, retiredDate: _retiredDate, ...rest } = hit
  const restored = {
    ...rest,
    employeeStatus: 'Active',
    restoredAt: new Date().toISOString(),
  }
  return {
    retiredStaff: retired.filter((r) => r.id !== retiredId),
    staffProfiles: active.some((p) => p.id === restored.id) ? active : [...active, restored],
  }
}
