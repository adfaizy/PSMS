export function parseRollTokensToSet(input) {
  const rollNums = new Set()
  const rawStr = new Set()
  const tokens = String(input || '')
    .split(/[,،\s]+/)
    .filter(Boolean)

  tokens.forEach((token) => {
    const part = token.trim()
    if (!part) return
    if (part.includes('-')) {
      const [startStr, endStr] = part.split('-').map((value) => value.trim())
      const start = parseInt(startStr, 10)
      const end = parseInt(endStr, 10)
      if (!Number.isNaN(start) && !Number.isNaN(end) && end >= start) {
        for (let n = start; n <= end; n += 1) rollNums.add(n)
      } else {
        rawStr.add(part.toLowerCase())
      }
    } else {
      const numeric = parseInt(part, 10)
      if (!Number.isNaN(numeric)) rollNums.add(numeric)
      else rawStr.add(part.toLowerCase())
    }
  })

  return { rollNums, rawStr }
}

export function parseAdmissionTokens(input) {
  return String(input || '')
    .split(/[,،]+/)
    .map((token) => token.trim().toLowerCase())
    .filter(Boolean)
}

export function selectStudentsForCards({ students, classId, rollInput = '', admissionInput = '' }) {
  const list = Array.isArray(students) ? students : []
  const classStudents = list.filter((student) => String(student?.classId || '') === String(classId || ''))
  if (!classStudents.length) return []

  const rollIn = String(rollInput || '').trim()
  const admissionIn = String(admissionInput || '').trim()
  if (!rollIn && !admissionIn) return []

  const byId = new Map()

  if (rollIn) {
    const { rollNums, rawStr } = parseRollTokensToSet(rollIn)
    classStudents.forEach((student) => {
      const rollNum = parseInt(String(student.rollNo || '').trim(), 10)
      const rollStr = String(student.rollNo || '').trim().toLowerCase()
      let ok = false
      if (rollNums.size > 0 && !Number.isNaN(rollNum) && rollNums.has(rollNum)) ok = true
      if (rawStr.size > 0 && rollStr && [...rawStr].some((token) => rollStr === token)) ok = true
      if (ok) byId.set(student.id, student)
    })
  }

  if (admissionIn) {
    const admissionTokens = parseAdmissionTokens(admissionIn)
    classStudents.forEach((student) => {
      const admission = String(student.admissionNo || '').trim().toLowerCase()
      if (admission && admissionTokens.some((token) => admission === token)) {
        byId.set(student.id, student)
      }
    })
  }

  return Array.from(byId.values())
}

export function filterStaffProfilesByQuery(staffProfiles, query) {
  const list = Array.isArray(staffProfiles) ? staffProfiles : []
  const q = String(query || '').trim()
  if (!q) return []

  const parts = q
    .split(/[,،]+/)
    .map((part) => part.trim().toLowerCase())
    .filter(Boolean)
  if (!parts.length) return []

  return list.filter((profile) => {
    const name = String(profile?.name || '').toLowerCase()
    return parts.some((part) => name.includes(part))
  })
}

export function buildStudentCardsPdfName(className, session) {
  const classPart = String(className || 'Class').replace(/\s+/g, '_')
  const sessionPart = String(session || '').replace(/\s+/g, '_')
  return `Student_Cards_${classPart}${sessionPart ? `_${sessionPart}` : ''}.pdf`
}
