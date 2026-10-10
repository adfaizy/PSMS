import { resolveClass as resolveClassSystem, formatClassDisplay as formatClassDisplaySystem } from '../systemSettings/systemSettingsCore'

function toNumber(value) {
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

function isNonTeachingCategory(value) {
  const v = String(value || '').trim().toLowerCase().replace(/[_-]+/g, ' ')
  const compact = v.replace(/\s+/g, '')
  return (
    compact === 'nonteaching' ||
    compact.startsWith('nonteaching') ||
    v.includes('non teaching') ||
    v.includes('worker') ||
    v.includes('clerk') ||
    v.includes('peon') ||
    v.includes('support') ||
    v.includes('labour') ||
    v.includes('labor')
  )
}

export function computeStaffCounts({ settings, staffProfiles }) {
  const profiles = Array.isArray(staffProfiles) ? staffProfiles : []
  if (profiles.length > 0) {
    const nonTeaching = profiles.filter((p) => isNonTeachingCategory(p?.staffCategory)).length
    const teaching = Math.max(0, profiles.length - nonTeaching)
    return { teaching, nonTeaching }
  }

  const staff = Array.isArray(settings?.staff) ? settings.staff : []
  const nonTeaching = staff.filter((s) =>
    isNonTeachingCategory(s?.staffCategory) || isNonTeachingCategory(s?.designation),
  ).length
  return { teaching: Math.max(0, staff.length - nonTeaching), nonTeaching }
}

export function subjectStatDash({ mode, exams, examTm, examOm, classId, studentId, subject }) {
  const tm = examTm || {}
  const om = examOm || {}
  let total = 0
  let obtained = 0

  const readTerm = (exam) => {
    const t = toNumber(tm[`${exam}_${classId}_${subject}`])
    const o = toNumber(om[`${exam}_${classId}_${studentId}_${subject}`])
    if (t !== null) total += t
    if (o !== null) obtained += o
  }

  if (mode === 'overall') {
    ;(exams || []).forEach(readTerm)
  } else {
    readTerm(mode)
  }

  return { total, obtained }
}

export function overallStatDash({ mode, exams, examTm, examOm, classId, studentId, subjects }) {
  let total = 0
  let obtained = 0
  ;(subjects || []).forEach((subject) => {
    const stat = subjectStatDash({ mode, exams, examTm, examOm, classId, studentId, subject })
    total += stat.total
    obtained += stat.obtained
  })
  if (total <= 0) return { hasMarks: false, pct: null }
  return { hasMarks: true, pct: (obtained / total) * 100 }
}

export function buildClassStats({ classes, students, exams, examMode, examTm, examOm, passThreshold, classSubjectsMap }) {
  return (classes || []).map((cls) => {
    const classStudents = (students || []).filter((student) => resolveClassSystem(classes, student.classId)?.id === cls.id)
    const subjects = classSubjectsMap?.[cls.id] || []
    let pass = 0
    let fail = 0

    classStudents.forEach((student) => {
      const stat = overallStatDash({
        mode: examMode,
        exams,
        examTm,
        examOm,
        classId: cls.id,
        studentId: student.id,
        subjects,
      })
      if (!stat.hasMarks) return
      if (stat.pct >= passThreshold) pass += 1
      else fail += 1
    })

    const count = classStudents.length
    const pending = Math.max(0, count - pass - fail)
    const passRatePct = count > 0 ? Math.round(((100 * pass) / count) * 10) / 10 : 0
    return {
      id: cls.id,
      name: formatClassDisplaySystem(cls),
      count,
      pass,
      fail,
      pending,
      passRatePct,
    }
  })
}

export function computeFeeStats({ feeRecords, classes, students, month, year, feeAmount = 20 }) {
  if (!feeRecords || !classes || !students) return { totalExpected: 0, totalCollected: 0, totalPending: 0, pct: 0 }

  let totalExpected = 0
  let totalCollected = 0

  classes.forEach((cls) => {
    const classStudents = students.filter((s) => {
      const studentClass = resolveClassSystem(classes, s.classId)
      return studentClass && String(studentClass.id) === String(cls.id)
    })
    totalExpected += classStudents.length * feeAmount

    const classRecords = feeRecords.filter((rec) => {
      const recordClass = resolveClassSystem(classes, rec.classId)
      return (
        recordClass &&
        String(recordClass.id) === String(cls.id) &&
        rec.month === month &&
        rec.year === year
      )
    })
    totalCollected += classRecords.reduce((sum, rec) => sum + (rec.amount || feeAmount), 0)
  })

  const pct = totalExpected > 0 ? (totalCollected / totalExpected) * 100 : 0
  return {
    totalExpected,
    totalCollected,
    totalPending: Math.max(0, totalExpected - totalCollected),
    pct: Math.round(pct * 10) / 10,
  }
}

function todayIsoLocal(d = new Date()) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}

/** Aggregate today's student attendance across all classes. Keys: `${classId}_${YYYY-MM-DD}`. */
export function computeTodayAttendance({ attendance, students, classes, date } = {}) {
  const dateStr = date || todayIsoLocal()
  const att = attendance && typeof attendance === 'object' ? attendance : {}
  const list = Array.isArray(students) ? students : []
  const classList = Array.isArray(classes) ? classes : []
  let present = 0
  let absent = 0
  let late = 0
  let unmarked = 0

  list.forEach((student) => {
    const cls = resolveClassSystem(classList, student.classId)
    const classId = cls?.id || student.classId
    if (!classId) {
      unmarked += 1
      return
    }
    const day = att[`${classId}_${dateStr}`] || att[`${student.classId}_${dateStr}`] || {}
    const st = day[student.id]
    if (st === 'P') present += 1
    else if (st === 'A') absent += 1
    else if (st === 'L') late += 1
    else unmarked += 1
  })

  const total = list.length
  const marked = present + absent + late
  const rate = total > 0 ? Math.round((present / total) * 1000) / 10 : 0
  return { date: dateStr, present, absent, late, unmarked, marked, total, rate }
}

/** Upcoming date-sheet rows (exam calendar). */
export function buildUpcomingExams({ datesheet, limit = 6 } = {}) {
  const ds = datesheet && typeof datesheet === 'object' ? datesheet : {}
  const dates = Array.isArray(ds.dates) ? ds.dates : []
  const today = todayIsoLocal()
  return dates
    .map((row) => ({
      id: row.id || row.date,
      date: String(row.date || '').slice(0, 10),
      note: String(row.note || '').trim(),
    }))
    .filter((row) => row.date && row.date >= today)
    .sort((a, b) => a.date.localeCompare(b.date))
    .slice(0, limit)
}

/** Operational reminders for the dashboard notification panel. */
export function buildDashboardReminders({
  students,
  classes,
  feeStats,
  attendanceToday,
  upcomingExams,
  staffCount,
} = {}) {
  const reminders = []
  const studentCount = Array.isArray(students) ? students.length : 0
  const classCount = Array.isArray(classes) ? classes.length : 0

  if (!classCount) {
    reminders.push({
      id: 'setup-classes',
      level: 'warning',
      title: 'School setup incomplete',
      detail: 'Add classes and sections in Academic Management to begin enrollment.',
      action: { page: 'academic', tab: 'classes', label: 'Open Academic' },
    })
  }
  if (classCount && !studentCount) {
    reminders.push({
      id: 'admit-students',
      level: 'info',
      title: 'No students enrolled',
      detail: 'Start admissions to populate Student Records.',
      action: { page: 'students', tab: 'admission', label: 'Open Admission' },
    })
  }
  if (attendanceToday && attendanceToday.total > 0 && attendanceToday.unmarked === attendanceToday.total) {
    reminders.push({
      id: 'mark-attendance',
      level: 'warning',
      title: 'Attendance not marked today',
      detail: 'No attendance entries recorded for today.',
      action: { page: 'attendance', tab: 'students', label: 'Mark Attendance' },
    })
  } else if (attendanceToday?.absent > 0) {
    reminders.push({
      id: 'absentees',
      level: 'info',
      title: `${attendanceToday.absent} absentee${attendanceToday.absent === 1 ? '' : 's'} today`,
      detail: 'Review absent students and update leave applications if needed.',
      action: { page: 'attendance', tab: 'reports', label: 'Open Reports' },
    })
  }
  if (feeStats && feeStats.totalPending > 0) {
    reminders.push({
      id: 'fee-dues',
      level: 'warning',
      title: 'Outstanding fee dues',
      detail: `Pending collection this month needs follow-up.`,
      action: { page: 'fees', tab: 'dues', label: 'View Dues' },
    })
  }
  if (Array.isArray(upcomingExams) && upcomingExams.length) {
    reminders.push({
      id: 'upcoming-exam',
      level: 'info',
      title: 'Upcoming examination date',
      detail: `Next date sheet entry: ${upcomingExams[0].date}`,
      action: { page: 'examination', tab: 'datesheet', label: 'Open Date Sheet' },
    })
  }
  if (!staffCount) {
    reminders.push({
      id: 'staff-profiles',
      level: 'info',
      title: 'Staff directory empty',
      detail: 'Add teaching and non-teaching staff profiles for ID cards and timetables.',
      action: { page: 'staff', tab: 'directory', label: 'Open Staff' },
    })
  }
  return reminders.slice(0, 8)
}

/** Global search across students and staff (authorized school data only). */
export function searchSchoolRecords({ query, students, staffProfiles, classes, limit = 12 } = {}) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
  if (!q || q.length < 1) return []
  const classList = Array.isArray(classes) ? classes : []
  const hits = []

  ;(Array.isArray(students) ? students : []).forEach((s) => {
    const cls = resolveClassSystem(classList, s.classId)
    const classLabel = formatClassDisplaySystem(cls) || String(s.classId || '')
    const hay = [
      s.name,
      s.fatherName,
      s.admissionNo,
      s.rollNo,
      s.whatsapp,
      s.bayForm,
      classLabel,
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    if (!hay.includes(q)) return
    hits.push({
      type: 'student',
      id: s.id,
      title: s.name || 'Student',
      subtitle: `Adm ${s.admissionNo || '—'} · Roll ${s.rollNo || '—'} · ${classLabel || '—'}`,
      page: 'students',
      tab: 'directory',
    })
  })

  ;(Array.isArray(staffProfiles) ? staffProfiles : []).forEach((p) => {
    const hay = [p.name, p.fname, p.designation, p.subj, p.contact, p.cnic, p.staffCategory]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    if (!hay.includes(q)) return
    hits.push({
      type: 'staff',
      id: p.id,
      title: p.name || 'Staff',
      subtitle: `${p.designation || 'Staff'} · ${p.staffCategory || '—'}`,
      page: 'staff',
      tab: 'directory',
    })
  })

  return hits.slice(0, limit)
}

export function countSections(classes) {
  const list = Array.isArray(classes) ? classes : []
  const sections = new Set()
  list.forEach((c) => {
    const sec = String(c?.section || '').trim()
    if (sec) sections.add(`${c.grade || c.name || c.id}|${sec}`)
  })
  return sections.size || list.length
}
