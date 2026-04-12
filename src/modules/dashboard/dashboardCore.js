import { resolveClass as resolveClassSystem, formatClassDisplay as formatClassDisplaySystem } from '../systemSettings/systemSettingsCore'

function toNumber(value) {
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

export function computeStaffCounts({ settings, staffProfiles }) {
  const profiles = Array.isArray(staffProfiles) ? staffProfiles : []
  if (profiles.length > 0) {
    const teaching = profiles.filter((p) =>
      String(p?.staffCategory || '').toLowerCase().includes('teaching') &&
      !String(p?.staffCategory || '').toLowerCase().includes('non'),
    ).length
    return { teaching, nonTeaching: Math.max(0, profiles.length - teaching) }
  }

  const staff = Array.isArray(settings?.staff) ? settings.staff : []
  const teaching = staff.filter((s) => {
    const text = `${s?.designation || ''} ${s?.staffCategory || ''}`.toLowerCase()
    return !text.includes('non') && !text.includes('worker')
  }).length
  return { teaching, nonTeaching: Math.max(0, staff.length - teaching) }
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
  if (!feeRecords || !classes || !students) return { totalExpected: 0, totalCollected: 0, pct: 0 }

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
    totalPending: totalExpected - totalCollected,
    pct: Math.round(pct * 10) / 10,
  }
}
