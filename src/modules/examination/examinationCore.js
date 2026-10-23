export const SCHOOL_EXAM_TERMS = ['1st Term', 'Mid Term', 'Final Term']
export const BISE_ANNUAL_EXAM = 'Annual'
export const EXAM_TERMS = [...SCHOOL_EXAM_TERMS, BISE_ANNUAL_EXAM]

const GRADE_WORDS = {
  one: 1,
  two: 2,
  three: 3,
  four: 4,
  five: 5,
  six: 6,
  seven: 7,
  eight: 8,
  nine: 9,
  ten: 10,
}

export function gradeNumberFromClass(cls) {
  if (!cls) return null
  const raw = String(cls.grade ?? cls.name ?? '').trim().toLowerCase()
  if (!raw) return null
  if (Object.prototype.hasOwnProperty.call(GRADE_WORDS, raw)) return GRADE_WORDS[raw]
  const match = raw.match(/\d{1,2}/)
  if (!match) return null
  const n = parseInt(match[0], 10)
  return Number.isNaN(n) ? null : n
}

/** Annual is the BISE Lahore result, used for class 9 and class 10 only. */
export function classHasBiseAnnual(cls) {
  const n = gradeNumberFromClass(cls)
  return n === 9 || n === 10
}

export function examsForClassRecord(cls) {
  return classHasBiseAnnual(cls) ? EXAM_TERMS : SCHOOL_EXAM_TERMS
}

export function examsForClassId(classes, classId) {
  const list = Array.isArray(classes) ? classes : []
  const id = String(classId ?? '')
  const cls = list.find((c) => String(c?.id) === id) || list.find((c) => String(c?.grade) === id)
  return examsForClassRecord(cls)
}

export function examTermLabel(exam) {
  return exam === BISE_ANNUAL_EXAM ? 'Annual (BISE Lahore)' : exam
}

function toNumber(value) {
  const parsed = parseFloat(value)
  return Number.isNaN(parsed) ? null : parsed
}

function safeMap(value) {
  return value && typeof value === 'object' ? value : {}
}

export function getTotalMarksKey(exam, classId, subject) {
  return `${exam}_${classId}_${subject}`
}

export function getObtainedMarksKey(exam, classId, studentId, subject) {
  return `${exam}_${classId}_${studentId}_${subject}`
}

export function getTotalMarks(examTm, exam, classId, subject) {
  const tm = safeMap(examTm)
  return tm[getTotalMarksKey(exam, classId, subject)] || ''
}

export function getObtainedMarks(examOm, exam, classId, studentId, subject) {
  const om = safeMap(examOm)
  return om[getObtainedMarksKey(exam, classId, studentId, subject)] || ''
}

export function setTotalMarks(examTm, exam, classId, subject, value) {
  const tm = safeMap(examTm)
  return {
    ...tm,
    [getTotalMarksKey(exam, classId, subject)]: value,
  }
}

export function setObtainedMarks(examTm, examOm, exam, classId, studentId, subject, value) {
  const total = toNumber(getTotalMarks(examTm, exam, classId, subject))
  const obtained = toNumber(value)
  if (value !== '' && obtained !== null && (obtained < 0 || (total !== null && obtained > total))) {
    return { ok: false, error: 'Obtained marks must be between 0 and subject total marks.' }
  }

  const om = safeMap(examOm)
  return {
    ok: true,
    examOm: {
      ...om,
      [getObtainedMarksKey(exam, classId, studentId, subject)]: value,
    },
  }
}

export function calculateExamTotals({ examTm, examOm, exam, classId, studentId, subjects }) {
  let totalMarks = 0
  let obtainedMarks = 0
  const list = Array.isArray(subjects) ? subjects : []

  list.forEach((subject) => {
    const total = toNumber(getTotalMarks(examTm, exam, classId, subject))
    const obtained = toNumber(getObtainedMarks(examOm, exam, classId, studentId, subject))
    if (total !== null) totalMarks += total
    if (obtained !== null) obtainedMarks += obtained
  })

  const percentage = totalMarks > 0 ? ((obtainedMarks / totalMarks) * 100).toFixed(1) : '—'
  return { totalMarks, obtainedMarks, percentage }
}

export function gradeFromPercentage(percentage, passThreshold = 50) {
  const pct = toNumber(percentage)
  if (pct === null) return '—'
  if (pct < passThreshold) return 'F'
  if (pct >= 80) return 'A+'
  if (pct >= 70) return 'A'
  if (pct >= 60) return 'B'
  if (pct >= 50) return 'C'
  if (pct >= 40) return 'D'
  return 'D'
}

export function subjectStat({ mode, exams = EXAM_TERMS, examTm, examOm, classId, studentId, subject, passThreshold = 50 }) {
  let total = 0
  let obtained = 0

  if (mode === 'overall') {
    exams.forEach((exam) => {
      const t = toNumber(getTotalMarks(examTm, exam, classId, subject))
      const o = toNumber(getObtainedMarks(examOm, exam, classId, studentId, subject))
      if (t !== null) total += t
      if (o !== null) obtained += o
    })
  } else {
    const t = toNumber(getTotalMarks(examTm, mode, classId, subject))
    const o = toNumber(getObtainedMarks(examOm, mode, classId, studentId, subject))
    if (t !== null) total = t
    if (o !== null) obtained = o
  }

  let percentage = '—'
  let grade = '—'
  let status = '—'
  if (total > 0) {
    const pct = (obtained / total) * 100
    percentage = pct.toFixed(1)
    grade = gradeFromPercentage(percentage, passThreshold)
    status = pct >= passThreshold ? 'PASS' : 'FAIL'
  }

  return { obtained, total, percentage, grade, status }
}

export function overallStat({ mode, exams = EXAM_TERMS, examTm, examOm, classId, studentId, subjects, passThreshold = 50 }) {
  let total = 0
  let obtained = 0
  ;(subjects || []).forEach((subject) => {
    const stat = subjectStat({ mode, exams, examTm, examOm, classId, studentId, subject, passThreshold })
    total += stat.total
    obtained += stat.obtained
  })

  let percentage = '—'
  let grade = '—'
  let status = '—'
  if (total > 0) {
    const pct = (obtained / total) * 100
    percentage = pct.toFixed(1)
    grade = gradeFromPercentage(percentage, passThreshold)
    status = pct >= passThreshold ? 'PASS' : 'FAIL'
  }

  return { obtained, total, percentage, grade, status }
}
