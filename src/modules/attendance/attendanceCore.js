export const ATTENDANCE_DATA_KEY = 'system_management_attendance'

const VALID_STATUSES = new Set(['P', 'A', 'L'])

function getStorage(storageOverride) {
  if (storageOverride) return storageOverride
  if (typeof window === 'undefined') return null
  return window.localStorage
}

function sanitizeDate(dateStr) {
  const value = String(dateStr || '').trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    throw new Error('Date must be in YYYY-MM-DD format')
  }
  return value
}

function toMap(value) {
  return value && typeof value === 'object' ? value : {}
}

export function loadAttendanceFromLocal(schoolId, storageOverride) {
  try {
    if (!schoolId) return {}
    const storage = getStorage(storageOverride)
    if (!storage) return {}
    const raw = storage.getItem(ATTENDANCE_DATA_KEY)
    if (!raw) return {}
    const allSchools = JSON.parse(raw)
    const schoolAttendance = allSchools?.[schoolId]
    return toMap(schoolAttendance)
  } catch {
    return {}
  }
}

export function saveAttendanceToLocal(schoolId, attendance, storageOverride) {
  try {
    if (!schoolId) return
    const storage = getStorage(storageOverride)
    if (!storage) return
    const raw = storage.getItem(ATTENDANCE_DATA_KEY)
    const allSchools = raw ? JSON.parse(raw) : {}
    allSchools[schoolId] = toMap(attendance)
    storage.setItem(ATTENDANCE_DATA_KEY, JSON.stringify(allSchools))
  } catch {
    // silent fail to keep app resilient in restricted storage contexts
  }
}

export function getAttendanceKey(classId, dateStr) {
  const safeClassId = String(classId || '').trim()
  const safeDate = sanitizeDate(dateStr)
  if (!safeClassId) {
    throw new Error('classId is required')
  }
  return `${safeClassId}_${safeDate}`
}

export function filterStudentsByClass(students, classId) {
  const list = Array.isArray(students) ? students : []
  if (!classId || classId === 'all') return list
  return list.filter((student) => String(student?.classId || '') === String(classId))
}

export function markStudentAttendance(attendance, { classId, date, studentId, status }) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error('status must be one of: P, A, L')
  }
  const key = getAttendanceKey(classId, date)
  const current = toMap(attendance)
  const dayMap = toMap(current[key])
  return {
    ...current,
    [key]: {
      ...dayMap,
      [studentId]: status,
    },
  }
}

export function markAllAttendance(attendance, { classId, date, students, status }) {
  if (!VALID_STATUSES.has(status)) {
    throw new Error('status must be one of: P, A, L')
  }
  const key = getAttendanceKey(classId, date)
  const selectedStudents = filterStudentsByClass(students, classId)
  const newDayMap = {}
  selectedStudents.forEach((student) => {
    if (student?.id) newDayMap[student.id] = status
  })
  return {
    ...toMap(attendance),
    [key]: newDayMap,
  }
}

export function getAttendanceSummary(attendance, { classId, date, students }) {
  const key = getAttendanceKey(classId, date)
  const selectedStudents = filterStudentsByClass(students, classId)
  const dayMap = toMap(toMap(attendance)[key])
  const total = selectedStudents.length
  const present = selectedStudents.filter((student) => dayMap[student.id] === 'P').length
  const absent = selectedStudents.filter((student) => dayMap[student.id] === 'A').length
  const late = selectedStudents.filter((student) => dayMap[student.id] === 'L').length
  const unmarked = Math.max(total - (present + absent + late), 0)
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0

  return { total, present, absent, late, unmarked, attendanceRate }
}

export function getStatusForDate(attendance, { classId, studentId, date }) {
  const key = getAttendanceKey(classId, date)
  const dayMap = toMap(toMap(attendance)[key])
  return dayMap[studentId] || '—'
}

export function buildMonthlyRegister(attendance, { classId, month, students }) {
  const value = String(month || '').trim()
  if (!/^\d{4}-\d{2}$/.test(value)) {
    throw new Error('month must be in YYYY-MM format')
  }

  const [year, monthNum] = value.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const dates = Array.from({ length: daysInMonth }, (_, index) => {
    const day = index + 1
    return `${year}-${String(monthNum).padStart(2, '0')}-${String(day).padStart(2, '0')}`
  })

  const selectedStudents = filterStudentsByClass(students, classId)
  const rows = selectedStudents.map((student) => ({
    studentId: student.id,
    rollNo: student.rollNo || '',
    name: student.name || '',
    fatherName: student.fatherName || '',
    statuses: dates.map((date) => getStatusForDate(attendance, { classId, studentId: student.id, date })),
  }))

  return { dates, rows }
}
