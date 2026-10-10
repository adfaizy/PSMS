import {
  formatClassDisplay,
  formatGradeLabel,
  resolveClass,
  addSessionToList,
  defaultSession,
} from '../systemSettings/systemSettingsCore'

export const ACADEMIC_TABS = [
  { id: 'overview', l: 'Overview' },
  { id: 'classes', l: 'Classes' },
  { id: 'subjects', l: 'Subjects' },
  { id: 'sessions', l: 'Sessions' },
  { id: 'calendar', l: 'Calendar' },
  { id: 'periods', l: 'Periods' },
  { id: 'scheme', l: 'Scheme' },
]

export const CALENDAR_EVENT_TYPES = ['Holiday', 'Event', 'Exam', 'Meeting', 'Other']

function newId() {
  return `acad_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function getExamSubjects(settings, classId) {
  const exam = settings?.classSubjectsExam
  if (exam && Array.isArray(exam[classId])) return exam[classId]
  const legacy = settings?.classSubjects
  if (legacy && Array.isArray(legacy[classId])) return legacy[classId]
  return []
}

function getTimetableSubjects(settings, classId) {
  const tt = settings?.classSubjectsTimetable
  if (tt && Array.isArray(tt[classId])) return tt[classId]
  return getExamSubjects(settings, classId)
}

export function summarizeAcademicStructure(settings, sessions = [], currentSession = '') {
  const classes = Array.isArray(settings?.classes) ? settings.classes : []
  let examSubjects = 0
  let timetableSubjects = 0
  const subjectSet = new Set()
  classes.forEach((c) => {
    const exam = getExamSubjects(settings, c.id)
    const tt = getTimetableSubjects(settings, c.id)
    examSubjects += exam.length
    timetableSubjects += tt.length
    exam.forEach((s) => subjectSet.add(String(s).trim().toLowerCase()))
    tt.forEach((s) => subjectSet.add(String(s).trim().toLowerCase()))
  })
  const grades = new Set(classes.map((c) => String(c.grade || '').trim()).filter(Boolean))
  const calendar = Array.isArray(settings?.academicCalendar) ? settings.academicCalendar : []
  const sessionList = Array.isArray(sessions) && sessions.length ? sessions : [currentSession || defaultSession()]
  return {
    classCount: classes.length,
    gradeCount: grades.size,
    uniqueSubjects: subjectSet.size,
    examSubjectSlots: examSubjects,
    timetableSubjectSlots: timetableSubjects,
    sessionCount: sessionList.length,
    currentSession: currentSession || sessionList[0] || defaultSession(),
    calendarEvents: calendar.length,
    periodsPerDay: Number(settings?.periodsPerDay) || 0,
  }
}

export function buildClassSubjectMatrix(settings) {
  const classes = Array.isArray(settings?.classes) ? settings.classes : []
  const subjectSet = new Set()
  const rows = classes.map((cls) => {
    const exam = getExamSubjects(settings, cls.id)
    const tt = getTimetableSubjects(settings, cls.id)
    exam.forEach((s) => subjectSet.add(s))
    tt.forEach((s) => subjectSet.add(s))
    return {
      classId: cls.id,
      label: formatClassDisplay(cls),
      grade: formatGradeLabel(cls.grade) || cls.grade || '',
      section: cls.section || '',
      exam,
      timetable: tt,
    }
  })
  return {
    rows,
    allSubjects: [...subjectSet].sort((a, b) => String(a).localeCompare(String(b))),
  }
}

export function addAcademicClass(settings, { grade, section }) {
  const g = String(grade || '').trim()
  if (!g) return { settings, error: 'Grade is required.' }
  const sec = String(section || '').trim()
  const temp = { grade: g, section: sec }
  const name = formatClassDisplay(temp)
  const id = `${g}-${sec || name}`
  const existing = Array.isArray(settings?.classes) ? settings.classes : []
  if (existing.find((c) => c.id === id || formatClassDisplay(c) === name)) {
    return { settings, error: 'Class already exists.' }
  }
  const newClass = { id, name, grade: g, section: sec }
  return {
    settings: {
      ...settings,
      classes: [...existing, newClass],
      classSubjects: { ...(settings?.classSubjects || {}), [id]: [] },
      classSubjectsExam: { ...(settings?.classSubjectsExam || {}), [id]: [] },
      classSubjectsTimetable: { ...(settings?.classSubjectsTimetable || {}), [id]: [] },
    },
    newClass,
    error: null,
  }
}

export function removeAcademicClass(settings, classId) {
  const prev = Array.isArray(settings?.classes) ? settings.classes : []
  return {
    ...settings,
    classes: prev.filter((c) => c.id !== classId),
    classSubjects: Object.fromEntries(Object.entries(settings?.classSubjects || {}).filter(([k]) => k !== classId)),
    classSubjectsExam: Object.fromEntries(Object.entries(settings?.classSubjectsExam || {}).filter(([k]) => k !== classId)),
    classSubjectsTimetable: Object.fromEntries(
      Object.entries(settings?.classSubjectsTimetable || {}).filter(([k]) => k !== classId),
    ),
  }
}

export function addClassSubject(settings, classId, subject, type = 'exam') {
  const cleaned = String(subject || '').trim()
  if (!cleaned || !classId) return settings
  if (type === 'timetable') {
    const list = getTimetableSubjects(settings, classId)
    if (list.includes(cleaned)) return settings
    return {
      ...settings,
      classSubjectsTimetable: {
        ...(settings.classSubjectsTimetable || {}),
        [classId]: [...list, cleaned],
      },
    }
  }
  const list = getExamSubjects(settings, classId)
  if (list.includes(cleaned)) return settings
  return {
    ...settings,
    classSubjects: { ...(settings.classSubjects || {}), [classId]: [...list, cleaned] },
    classSubjectsExam: { ...(settings.classSubjectsExam || {}), [classId]: [...list, cleaned] },
  }
}

export function removeClassSubject(settings, classId, subject, type = 'exam') {
  if (!classId || !subject) return settings
  if (type === 'timetable') {
    return {
      ...settings,
      classSubjectsTimetable: {
        ...(settings.classSubjectsTimetable || {}),
        [classId]: getTimetableSubjects(settings, classId).filter((x) => x !== subject),
      },
    }
  }
  const next = getExamSubjects(settings, classId).filter((x) => x !== subject)
  return {
    ...settings,
    classSubjects: { ...(settings.classSubjects || {}), [classId]: next },
    classSubjectsExam: { ...(settings.classSubjectsExam || {}), [classId]: next },
  }
}

export function normalizeSessionList(sessions, currentSession) {
  const list = Array.isArray(sessions) ? sessions.filter(Boolean) : []
  const cur = String(currentSession || '').trim()
  if (cur && !list.includes(cur)) return [...list, cur].sort()
  if (list.length) return [...list].sort()
  return [defaultSession()]
}

export function validateSessionLabel(value) {
  const session = String(value || '').trim()
  if (!/^\d{4}-\d{4}$/.test(session)) return { ok: false, session: '', error: 'Use format YYYY-YYYY (e.g. 2025-2026).' }
  return { ok: true, session, error: null }
}

export function mergeSessionIntoList(sessions, newSession) {
  return addSessionToList(sessions, newSession)
}

export function addCalendarEvent(calendar, { title, date, endDate, type, notes }) {
  const entry = {
    id: newId(),
    title: String(title || '').trim() || 'Untitled',
    date: String(date || '').trim(),
    endDate: String(endDate || date || '').trim(),
    type: CALENDAR_EVENT_TYPES.includes(type) ? type : 'Event',
    notes: String(notes || '').trim(),
    createdAt: new Date().toISOString(),
  }
  if (!entry.date) return Array.isArray(calendar) ? calendar : []
  const prev = Array.isArray(calendar) ? calendar : []
  return [...prev, entry].sort((a, b) => String(a.date).localeCompare(String(b.date)))
}

export function removeCalendarEvent(calendar, eventId) {
  return (Array.isArray(calendar) ? calendar : []).filter((e) => e.id !== eventId)
}

export function upcomingCalendarEvents(calendar, fromDate = new Date().toISOString().slice(0, 10), limit = 8) {
  return (Array.isArray(calendar) ? calendar : [])
    .filter((e) => String(e.date || '') >= fromDate)
    .slice(0, limit)
}

export function addSchemeUnit(scheme, classId, subject, { unit, topics, periods }) {
  const next = scheme && typeof scheme === 'object' ? { ...scheme } : {}
  const byClass = next[classId] && typeof next[classId] === 'object' ? { ...next[classId] } : {}
  const list = Array.isArray(byClass[subject]) ? [...byClass[subject]] : []
  list.push({
    id: newId(),
    unit: String(unit || '').trim() || `Unit ${list.length + 1}`,
    topics: String(topics || '').trim(),
    periods: Number(periods) || 0,
    createdAt: new Date().toISOString(),
  })
  byClass[subject] = list
  next[classId] = byClass
  return next
}

export function removeSchemeUnit(scheme, classId, subject, unitId) {
  const next = scheme && typeof scheme === 'object' ? { ...scheme } : {}
  const byClass = next[classId] && typeof next[classId] === 'object' ? { ...next[classId] } : {}
  byClass[subject] = (Array.isArray(byClass[subject]) ? byClass[subject] : []).filter((u) => u.id !== unitId)
  next[classId] = byClass
  return next
}

export function getSchemeUnits(scheme, classId, subject) {
  return scheme?.[classId]?.[subject] || []
}

export function resolveAcademicClass(classes, classId) {
  return resolveClass(classes, classId)
}

export { formatClassDisplay, formatGradeLabel, defaultSession }
