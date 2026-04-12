import { resolveClass, normKey } from '../systemSettings/systemSettingsCore';

function normalizeRollNo(roll) {
  const value = normKey(roll)
  if (/^\d+$/.test(value)) {
    const n = parseInt(value, 10)
    return Number.isNaN(n) ? value : String(n)
  }
  return value
}

function getRollNumberScopeClassIds(classes, classId, commonTeachers) {
  const selectedClass = resolveClass(classes, classId)
  if (!selectedClass) return [normKey(classId)]
  const grade = String(selectedClass.grade || '').trim()
  const gradeCommon = commonTeachers?.[grade] || {}
  const hasAnyCommon = Object.values(gradeCommon).some(Boolean)
  if (!hasAnyCommon) return [String(selectedClass.id)]

  const sameGradeSectionClasses = (classes || []).filter(
    (item) => String(item.grade || '').trim() === grade && String(item.section || '').trim(),
  )
  if (sameGradeSectionClasses.length < 2) return [String(selectedClass.id)]
  return sameGradeSectionClasses.map((item) => String(item.id))
}

function maxNumericFromAdmissionStrings(students) {
  let max = 0
  for (const student of students || []) {
    const admission = String(student?.admissionNo || '').trim()
    const digits = admission.replace(/\D/g, '')
    if (!digits) continue
    const parsed = parseInt(digits, 10)
    if (!Number.isNaN(parsed)) max = Math.max(max, parsed)
  }
  return max
}

function maxRollInClass(students, classes, classId, commonTeachers) {
  const selectedClass = resolveClass(classes, classId)
  const scopeIds = new Set(getRollNumberScopeClassIds(classes, classId, commonTeachers))
  const filtered = (students || []).filter((student) => {
    const studentClass = resolveClass(classes, student.classId)
    if (selectedClass && studentClass) return scopeIds.has(String(studentClass.id))
    return scopeIds.has(normKey(student.classId))
  })

  let max = 0
  for (const student of filtered) {
    const roll = String(student?.rollNo || '').trim()
    if (!/^\d+$/.test(roll)) continue
    const parsed = parseInt(roll, 10)
    if (!Number.isNaN(parsed)) max = Math.max(max, parsed)
  }
  return max
}

export function findStudentByAdmissionNo(students, admissionNo, excludeId) {
  const key = normKey(admissionNo)
  if (!key) return null
  for (const student of students || []) {
    if (excludeId && student.id === excludeId) continue
    if (normKey(student.admissionNo) === key) return student
  }
  return null
}

export function findStudentByRollInClass(students, classes, classId, rollNo, excludeId, commonTeachers) {
  const rollKey = normalizeRollNo(rollNo)
  if (!rollKey) return null
  const selectedClass = resolveClass(classes, classId)
  const scopeIds = new Set(getRollNumberScopeClassIds(classes, classId, commonTeachers))

  for (const student of students || []) {
    if (excludeId && student.id === excludeId) continue
    const studentClass = resolveClass(classes, student.classId)
    const sameClass = selectedClass && studentClass ? scopeIds.has(String(studentClass.id)) : scopeIds.has(normKey(student.classId))
    if (!sameClass) continue
    if (normalizeRollNo(student.rollNo) === rollKey) return student
  }
  return null
}

export function nextAdmissionNo(students) {
  return String(maxNumericFromAdmissionStrings(students) + 1)
}

export function nextRollNoForClass(students, classes, classId, commonTeachers) {
  return String(maxRollInClass(students, classes, classId, commonTeachers) + 1)
}

export function toProperCase(value) {
  return String(value || '')
    .toLowerCase()
    .replace(/\b\w/g, (match) => match.toUpperCase())
}

export function createAdmissionRecord({
  form,
  students,
  classes,
  commonTeachers,
  idFactory = () => `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
}) {
  const input = form || {}
  const list = Array.isArray(students) ? students : []
  if (!String(input.name || '').trim()) {
    return { ok: false, error: 'Student Name is required.' }
  }

  let admissionNo = String(input.admissionNo || '').trim()
  let rollNo = String(input.rollNo || '').trim()
  if (!admissionNo) admissionNo = nextAdmissionNo(list)
  if (!rollNo) rollNo = nextRollNoForClass(list, classes, input.classId, commonTeachers)

  const duplicateAdmission = findStudentByAdmissionNo(list, admissionNo, null)
  if (duplicateAdmission) {
    return { ok: false, error: 'Admission number already exists.', duplicate: duplicateAdmission }
  }

  const duplicateRoll = findStudentByRollInClass(list, classes, input.classId, rollNo, null, commonTeachers)
  if (duplicateRoll) {
    return { ok: false, error: 'Roll number already exists in class scope.', duplicate: duplicateRoll }
  }

  const record = {
    ...input,
    id: idFactory(),
    admissionNo,
    rollNo,
    name: toProperCase(input.name || ''),
    fatherName: toProperCase(input.fatherName || ''),
    photo: input.photo || null,
  }

  return { ok: true, record }
}
