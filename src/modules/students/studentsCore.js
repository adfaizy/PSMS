import { resolveClass, formatClassDisplay } from '../systemSettings/systemSettingsCore'

export const STUDENTS_TABS = [
  { id: 'admission', l: 'Admission' },
  { id: 'directory', l: 'Directory' },
  { id: 'promotion', l: 'Promotion' },
  { id: 'documents', l: 'Documents' },
  { id: 'health', l: 'Health' },
  { id: 'discipline', l: 'Discipline' },
  { id: 'leaving', l: 'Leaving' },
  { id: 'alumni', l: 'Alumni' },
]

export const STUDENT_STATUS = {
  ACTIVE: 'active',
  PROMOTED: 'promoted',
  RETAINED: 'retained',
  TRANSFERRED: 'transferred',
  WITHDRAWN: 'withdrawn',
  GRADUATED: 'graduated',
  ALUMNI: 'alumni',
}

export const STUDENT_STATUS_LABELS = {
  active: 'Active',
  promoted: 'Promoted',
  retained: 'Retained',
  transferred: 'Transferred',
  withdrawn: 'Withdrawn',
  graduated: 'Graduated',
  alumni: 'Alumni',
}

export const DISCIPLINE_TYPES = [
  'Warning',
  'Incident',
  'Corrective Action',
  'Counseling',
  'Follow-up',
]

export const LEAVING_CERTIFICATE_TYPES = [
  'School Leaving Certificate',
  'Character Certificate',
  'Transfer Certificate',
  'Bonafide Certificate',
]

export function getStudentStatus(student) {
  const raw = String(student?.studentStatus || '').trim().toLowerCase()
  if (raw && STUDENT_STATUS_LABELS[raw]) return raw
  if (student?.leavingInfo?.type) return STUDENT_STATUS.WITHDRAWN
  if (student?.promotionInfo?.promotedAt) return STUDENT_STATUS.ACTIVE
  return STUDENT_STATUS.ACTIVE
}

export function isActiveStudent(student) {
  const status = getStudentStatus(student)
  return status === STUDENT_STATUS.ACTIVE || status === STUDENT_STATUS.PROMOTED || status === STUDENT_STATUS.RETAINED
}

export function isAlumniStudent(student) {
  const status = getStudentStatus(student)
  return (
    status === STUDENT_STATUS.ALUMNI ||
    status === STUDENT_STATUS.GRADUATED ||
    status === STUDENT_STATUS.WITHDRAWN ||
    status === STUDENT_STATUS.TRANSFERRED
  )
}

export function filterStudentsByStatus(students, mode = 'active') {
  const list = Array.isArray(students) ? students : []
  if (mode === 'all') return list
  if (mode === 'alumni') return list.filter(isAlumniStudent)
  return list.filter(isActiveStudent)
}

export function searchStudents({ students, classes, query, classId = 'all', statusMode = 'active' } = {}) {
  const q = String(query || '')
    .trim()
    .toLowerCase()
  let list = filterStudentsByStatus(students, statusMode)
  if (classId && classId !== 'all') {
    const filterCls = resolveClass(classes, classId)
    list = list.filter((s) => {
      const sc = resolveClass(classes, s.classId)
      return filterCls && sc && String(filterCls.id) === String(sc.id)
    })
  }
  if (!q) return list
  return list.filter((s) => {
    const cls = resolveClass(classes, s.classId)
    const hay = [
      s.name,
      s.fatherName,
      s.admissionNo,
      s.rollNo,
      s.whatsapp,
      s.bayForm,
      s.fatherCnic,
      formatClassDisplay(cls),
      STUDENT_STATUS_LABELS[getStudentStatus(s)],
    ]
      .map((v) => String(v || '').toLowerCase())
      .join(' ')
    return hay.includes(q)
  })
}

function newId() {
  return `rec_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function addHealthNote(student, noteText) {
  const note = String(noteText || '').trim()
  if (!note) return student
  const entry = {
    id: newId(),
    note,
    createdAt: new Date().toISOString(),
  }
  const prev = Array.isArray(student?.healthNotes) ? student.healthNotes : []
  return { ...student, healthNotes: [entry, ...prev] }
}

export function removeHealthNote(student, noteId) {
  const prev = Array.isArray(student?.healthNotes) ? student.healthNotes : []
  return { ...student, healthNotes: prev.filter((n) => n.id !== noteId) }
}

export function addDisciplineRecord(student, { type, detail, action, followUp }) {
  const entry = {
    id: newId(),
    type: String(type || 'Warning').trim() || 'Warning',
    detail: String(detail || '').trim(),
    action: String(action || '').trim(),
    followUp: String(followUp || '').trim(),
    createdAt: new Date().toISOString(),
  }
  if (!entry.detail) return student
  const prev = Array.isArray(student?.disciplineRecords) ? student.disciplineRecords : []
  return { ...student, disciplineRecords: [entry, ...prev] }
}

export function removeDisciplineRecord(student, recordId) {
  const prev = Array.isArray(student?.disciplineRecords) ? student.disciplineRecords : []
  return { ...student, disciplineRecords: prev.filter((r) => r.id !== recordId) }
}

export function addStudentDocument(student, { name, docType, dataUrl, mime }) {
  const entry = {
    id: newId(),
    name: String(name || 'Document').trim() || 'Document',
    docType: String(docType || 'Other').trim() || 'Other',
    dataUrl: dataUrl || null,
    mime: mime || '',
    uploadedAt: new Date().toISOString(),
  }
  const prev = Array.isArray(student?.documents) ? student.documents : []
  return { ...student, documents: [entry, ...prev] }
}

export function removeStudentDocument(student, docId) {
  const prev = Array.isArray(student?.documents) ? student.documents : []
  return { ...student, documents: prev.filter((d) => d.id !== docId) }
}

export function setLeavingInfo(student, { type, issueDate, reason, remarks, nextStatus }) {
  const leavingInfo = {
    type: String(type || LEAVING_CERTIFICATE_TYPES[0]).trim(),
    issueDate: String(issueDate || new Date().toISOString().slice(0, 10)),
    reason: String(reason || '').trim(),
    remarks: String(remarks || '').trim(),
    issuedAt: new Date().toISOString(),
  }
  return {
    ...student,
    leavingInfo,
    studentStatus: nextStatus || STUDENT_STATUS.WITHDRAWN,
  }
}

export function setStudentLifecycleStatus(student, status, extra = {}) {
  const next = String(status || STUDENT_STATUS.ACTIVE).toLowerCase()
  return {
    ...student,
    studentStatus: STUDENT_STATUS_LABELS[next] ? next : STUDENT_STATUS.ACTIVE,
    statusUpdatedAt: new Date().toISOString(),
    ...extra,
  }
}

export function getNextGradeClassOptions(classes, fromClassId) {
  const list = Array.isArray(classes) ? classes : []
  const from = resolveClass(list, fromClassId)
  if (!from) return []
  const gradeNum = parseInt(String(from.grade || '').match(/\d{1,2}/)?.[0] || '', 10)
  if (Number.isNaN(gradeNum)) return []
  const nextGrade = String(gradeNum + 1)
  return list.filter((c) => String(c.grade || '').includes(nextGrade) || String(c.grade || '') === nextGrade)
}

export function summarizeStudentDirectory(students, classes) {
  const active = filterStudentsByStatus(students, 'active')
  const alumni = filterStudentsByStatus(students, 'alumni')
  const byClass = {}
  ;(classes || []).forEach((c) => {
    byClass[c.id] = active.filter((s) => resolveClass(classes, s.classId)?.id === c.id).length
  })
  return {
    total: Array.isArray(students) ? students.length : 0,
    active: active.length,
    alumni: alumni.length,
    byClass,
  }
}
