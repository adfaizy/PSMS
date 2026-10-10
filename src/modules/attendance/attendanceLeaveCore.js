import { resolveClass, formatClassDisplay } from '../systemSettings/systemSettingsCore'
import { getAttendanceSummary, loadAttendanceFromLocal } from './attendanceCore'
import {
  loadStaffAttendanceFromLocal,
  summarizeStaffAttendanceDay,
  searchStaffProfiles,
  LEAVE_STATUS,
  LEAVE_STATUS_LABELS,
  LEAVE_TYPES as STAFF_LEAVE_TYPES,
} from '../staff/staffCore'

export const ATTENDANCE_LEAVE_TABS = [
  { id: 'overview', l: 'Overview' },
  { id: 'students', l: 'Students' },
  { id: 'studentLeave', l: 'Student Leave' },
  { id: 'staff', l: 'Staff' },
  { id: 'staffLeave', l: 'Staff Leave' },
  { id: 'reports', l: 'Reports' },
]

export const STUDENT_LEAVE_TYPES = ['Sick', 'Casual', 'Emergency', 'Family', 'Other']

export { LEAVE_STATUS, LEAVE_STATUS_LABELS, STAFF_LEAVE_TYPES }

function newId() {
  return `leave_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function addStudentLeaveRecord(student, { type, fromDate, toDate, reason, status }) {
  const entry = {
    id: newId(),
    type: String(type || STUDENT_LEAVE_TYPES[0]).trim() || STUDENT_LEAVE_TYPES[0],
    fromDate: String(fromDate || '').trim(),
    toDate: String(toDate || fromDate || '').trim(),
    reason: String(reason || '').trim(),
    status: LEAVE_STATUS_LABELS[status] ? status : LEAVE_STATUS.PENDING,
    createdAt: new Date().toISOString(),
  }
  if (!entry.fromDate) return student
  const prev = Array.isArray(student?.leaveRecords) ? student.leaveRecords : []
  return { ...student, leaveRecords: [entry, ...prev] }
}

export function updateStudentLeaveStatus(student, leaveId, status) {
  const prev = Array.isArray(student?.leaveRecords) ? student.leaveRecords : []
  return {
    ...student,
    leaveRecords: prev.map((r) =>
      r.id === leaveId ? { ...r, status, updatedAt: new Date().toISOString() } : r,
    ),
  }
}

export function removeStudentLeaveRecord(student, leaveId) {
  const prev = Array.isArray(student?.leaveRecords) ? student.leaveRecords : []
  return { ...student, leaveRecords: prev.filter((r) => r.id !== leaveId) }
}

export function listAllStudentLeaves(students) {
  const rows = []
  ;(Array.isArray(students) ? students : []).forEach((s) => {
    ;(Array.isArray(s.leaveRecords) ? s.leaveRecords : []).forEach((r) => {
      rows.push({
        ...r,
        studentId: s.id,
        studentName: s.name || 'Student',
        classId: s.classId,
        admissionNo: s.admissionNo || '',
        rollNo: s.rollNo || '',
      })
    })
  })
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

export function listAllStaffLeaves(staffProfiles) {
  const rows = []
  ;(Array.isArray(staffProfiles) ? staffProfiles : []).forEach((p) => {
    ;(Array.isArray(p.leaveRecords) ? p.leaveRecords : []).forEach((r) => {
      rows.push({
        ...r,
        staffId: p.id,
        staffName: p.name || 'Staff',
        designation: p.designation || '',
      })
    })
  })
  return rows.sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')))
}

/** Aggregate student attendance for a date across all classes (or one class). */
export function summarizeSchoolStudentAttendance(attendance, { classes, students, date, classId = 'all' }) {
  const classList = Array.isArray(classes) ? classes : []
  const studentList = Array.isArray(students) ? students : []
  if (classId && classId !== 'all') {
    return getAttendanceSummary(attendance, { classId, date, students: studentList })
  }
  let total = 0
  let present = 0
  let absent = 0
  let late = 0
  let unmarked = 0
  classList.forEach((cls) => {
    const part = getAttendanceSummary(attendance, { classId: cls.id, date, students: studentList })
    total += part.total
    present += part.present
    absent += part.absent
    late += part.late
    unmarked += part.unmarked
  })
  // Students whose classId doesn't resolve still count once under "loose" filter
  if (!classList.length) {
    const part = getAttendanceSummary(attendance, {
      classId: studentList[0]?.classId || 'none',
      date,
      students: studentList,
    })
    return part
  }
  const attendanceRate = total > 0 ? Math.round((present / total) * 100) : 0
  return { total, present, absent, late, unmarked, attendanceRate }
}

export function summarizeTodayAttendanceLeave({
  activeSchoolId,
  classes,
  students,
  staffProfiles,
  date = new Date().toISOString().slice(0, 10),
} = {}) {
  const studentAtt = loadAttendanceFromLocal(activeSchoolId || '')
  const staffAtt = loadStaffAttendanceFromLocal(activeSchoolId || '')
  const studentSummary = summarizeSchoolStudentAttendance(studentAtt, {
    classes,
    students,
    date,
  })
  const activeStaff = searchStaffProfiles({
    profiles: staffProfiles,
    query: '',
    category: 'all',
    statusMode: 'active',
  })
  const staffSummary = summarizeStaffAttendanceDay(
    staffAtt,
    date,
    activeStaff.map((p) => p.id),
  )
  const studentLeaves = listAllStudentLeaves(students)
  const staffLeaves = listAllStaffLeaves(staffProfiles)
  const pendingStudent = studentLeaves.filter((r) => r.status === LEAVE_STATUS.PENDING).length
  const pendingStaff = staffLeaves.filter((r) => r.status === LEAVE_STATUS.PENDING).length
  const approvedStudentOpen = studentLeaves.filter(
    (r) => r.status === LEAVE_STATUS.APPROVED && String(r.toDate || r.fromDate) >= date,
  ).length
  const approvedStaffOpen = staffLeaves.filter(
    (r) => r.status === LEAVE_STATUS.APPROVED && String(r.toDate || r.fromDate) >= date,
  ).length

  return {
    date,
    students: studentSummary,
    staff: staffSummary,
    leave: {
      pendingStudent,
      pendingStaff,
      activeStudent: approvedStudentOpen,
      activeStaff: approvedStaffOpen,
      studentTotal: studentLeaves.length,
      staffTotal: staffLeaves.length,
    },
  }
}

export function buildAbsenteeList(attendance, { classes, students, date }) {
  const rows = []
  ;(Array.isArray(classes) ? classes : []).forEach((cls) => {
    const key = `${cls.id}_${date}`
    const day = attendance?.[key] && typeof attendance[key] === 'object' ? attendance[key] : {}
    ;(Array.isArray(students) ? students : [])
      .filter((s) => resolveClass(classes, s.classId)?.id === cls.id)
      .forEach((s) => {
        if (day[s.id] === 'A' || day[s.id] === 'L') {
          rows.push({
            id: s.id,
            name: s.name || 'Student',
            rollNo: s.rollNo || '',
            classLabel: formatClassDisplay(cls),
            status: day[s.id],
          })
        }
      })
  })
  return rows
}

export function computeMonthlyStudentRates(attendance, { classId, month, students }) {
  const value = String(month || '').trim()
  if (!/^\d{4}-\d{2}$/.test(value)) return []
  const [year, monthNum] = value.split('-').map(Number)
  const daysInMonth = new Date(year, monthNum, 0).getDate()
  const list = (Array.isArray(students) ? students : []).filter(
    (s) => !classId || classId === 'all' || String(s.classId) === String(classId),
  )
  return list.map((s) => {
    let present = 0
    let absent = 0
    let late = 0
    let marked = 0
    for (let d = 1; d <= daysInMonth; d += 1) {
      const date = `${year}-${String(monthNum).padStart(2, '0')}-${String(d).padStart(2, '0')}`
      const key = `${s.classId}_${date}`
      const st = attendance?.[key]?.[s.id]
      if (st === 'P') {
        present += 1
        marked += 1
      } else if (st === 'A') {
        absent += 1
        marked += 1
      } else if (st === 'L') {
        late += 1
        marked += 1
      }
    }
    const rate = marked > 0 ? Math.round((present / marked) * 100) : 0
    return {
      studentId: s.id,
      name: s.name || '',
      rollNo: s.rollNo || '',
      present,
      absent,
      late,
      marked,
      rate,
    }
  })
}
