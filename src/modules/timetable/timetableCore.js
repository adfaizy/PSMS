const WEEK_DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday']

function parseStartMinutes(timeStr) {
  const value = String(timeStr || '')
  const [h, m] = value.split(':').map(Number)
  if (Number.isNaN(h) || Number.isNaN(m)) return 0
  return h * 60 + m
}

export function calcTimes(settings, day) {
  const isFriday = day === 'Friday'
  const isSaturday = day === 'Saturday'
  const key = isFriday ? 'friday' : isSaturday ? 'saturday' : 'mondayToThursday'
  const start = settings?.schoolHours?.[key]?.start || '08:30'
  let minutes = parseStartMinutes(start)

  const assemblyTime = Number(settings?.assemblyTime) || 15
  const firstPeriodTime = Number(settings?.firstPeriodTime) || 40
  const otherPeriodTime = Number(settings?.otherPeriodTime) || 30
  const periodsPerDay = Number(settings?.periodsPerDay) || 8

  const assemblyStart = minutes
  const assemblyEnd = minutes + assemblyTime
  minutes = assemblyEnd

  const breakRequired = isFriday ? !!settings?.fridayBreak : !!settings?.breakRequired
  const breakAfter = isFriday ? Number(settings?.fridayBreakAfter) : Number(settings?.breakAfterPeriod)
  const breakDuration = isFriday ? Number(settings?.fridayBreakDuration) : Number(settings?.breakDuration)

  const rows = []
  for (let i = 0; i < periodsPerDay; i += 1) {
    const startMinute = minutes
    const periodDuration = i === 0 ? firstPeriodTime : otherPeriodTime
    minutes += periodDuration
    rows.push({ isBreak: false, idx: i, start: startMinute, end: minutes })
    if (breakRequired && i + 1 === breakAfter) {
      rows.push({ isBreak: true, start: minutes, end: minutes + breakDuration })
      minutes += breakDuration
    }
  }

  return { assemblyStart, assemblyEnd, rows }
}

export function getTimetableCell(timetable, classId, day, periodIndex) {
  return timetable?.[classId]?.[day]?.[periodIndex] || { subject: '', teacher: '' }
}

export function setTimetableCellAllDays(timetable, classId, periodIndex, value) {
  const source = timetable && typeof timetable === 'object' ? timetable : {}
  const classMap = source[classId] || {}
  const nextClassMap = { ...classMap }

  WEEK_DAYS.forEach((day) => {
    nextClassMap[day] = {
      ...(classMap[day] || {}),
      [periodIndex]: value,
    }
  })

  return {
    ...source,
    [classId]: nextClassMap,
  }
}

export function parseABVariantSubject(subject) {
  const value = String(subject || '').trim()
  if (!value) return null

  let match = value.match(/^(.*?)(?:\s*\(\s*([ABab])\s*\))\s*$/)
  if (!match) match = value.match(/^(.*?)(?:\s*\[\s*([ABab])\s*\])\s*$/)
  if (!match) match = value.match(/^(.*?)(?:\s+Part\s*([ABab]))\s*$/i)
  if (!match) match = value.match(/^(.*?)[\s\-–—]+\s*([ABab])\s*$/)
  if (!match) return null

  const base = String(match[1] || '').trim().toLowerCase()
  const variant = String(match[2] || '').trim().toUpperCase()
  if (!base || (variant !== 'A' && variant !== 'B')) return null
  return { base, variant }
}

export function isABCounterpartSubject(a, b) {
  const left = parseABVariantSubject(a)
  const right = parseABVariantSubject(b)
  if (!left || !right) return false
  return left.base === right.base && left.variant !== right.variant
}

export function subjectUsedInDay(timetable, classId, day, subject, excludePeriodIndex = -1) {
  const periodMap = timetable?.[classId]?.[day] || {}
  return Object.entries(periodMap).some(([periodIndex, cell]) => {
    if (Number(periodIndex) === Number(excludePeriodIndex)) return false
    return String(cell?.subject || '') === String(subject || '')
  })
}
