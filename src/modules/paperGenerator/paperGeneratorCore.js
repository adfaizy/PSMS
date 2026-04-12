function safeObject(value) {
  return value && typeof value === 'object' ? value : {}
}

function generateId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 6)}`
}

export function getQuestionBankForCurrent({ questionBank, classId, subject, isCommonSubject = false, grade }) {
  if (!subject) return []
  const bank = safeObject(questionBank)
  if (isCommonSubject && grade) {
    return bank.common?.[grade]?.[subject] || []
  }
  return bank?.[classId]?.[subject] || []
}

export function setQuestionBankForCurrent({
  questionBank,
  classId,
  subject,
  list,
  isCommonSubject = false,
  grade,
}) {
  if (!subject || !Array.isArray(list)) return safeObject(questionBank)
  const next = { ...safeObject(questionBank) }

  if (isCommonSubject && grade) {
    next.common = safeObject(next.common)
    next.common[grade] = safeObject(next.common[grade])
    next.common[grade] = { ...next.common[grade], [subject]: list }
    return next
  }

  next[classId] = safeObject(next[classId])
  next[classId] = { ...next[classId], [subject]: list }
  return next
}

export function filterQuestionBank(list, filters) {
  const bank = Array.isArray(list) ? list : []
  const f = filters || {}
  return bank.filter((q) => {
    const matchType = !f.type || f.type === 'all' || q.type === f.type
    const matchDifficulty = !f.difficulty || f.difficulty === 'all' || q.difficulty === f.difficulty
    const matchChapter = !f.chapter || f.chapter === 'all' || q.chapter === f.chapter
    const matchTopic = !f.topic || f.topic === 'all' || q.topic === f.topic
    const search = String(f.search || '').toLowerCase()
    const matchSearch = !search || String(q.text || '').toLowerCase().includes(search)
    return matchType && matchDifficulty && matchChapter && matchTopic && matchSearch
  })
}

export function pickRandom(arr, count) {
  const copy = [...(Array.isArray(arr) ? arr : [])]
  const out = []
  for (let i = 0; i < count && copy.length; i += 1) {
    const index = Math.floor(Math.random() * copy.length)
    out.push(copy.splice(index, 1)[0])
  }
  return out
}

export function generatePaperFromBank({ questionBank, chapter = 'all', topic = 'all', percentMcq = '', percentShort = '', percentLong = '' }) {
  const bank = Array.isArray(questionBank) ? questionBank : []
  const pool = bank.filter(
    (q) => (chapter === 'all' || q.chapter === chapter) && (topic === 'all' || q.topic === topic),
  )
  const poolMcq = pool.filter((q) => q.type === 'MCQs')
  const poolShort = pool.filter((q) => q.type === 'Short')
  const poolLong = pool.filter((q) => q.type === 'Long')

  const percentToCount = (group, inputPercent) => {
    if (!inputPercent) return group.length
    const v = parseFloat(inputPercent)
    return Number.isNaN(v) ? group.length : Math.floor((v / 100) * group.length)
  }

  const selectedMcq = pickRandom(poolMcq, percentToCount(poolMcq, percentMcq))
  const selectedShort = pickRandom(poolShort, percentToCount(poolShort, percentShort))
  const selectedLong = pickRandom(poolLong, percentToCount(poolLong, percentLong))

  return [
    {
      id: 1,
      title: 'Section A - Objective',
      type: 'MCQs',
      marks: selectedMcq.length,
      instructions: 'Choose the correct option.',
      questions: selectedMcq.map((q) => ({
        id: generateId(),
        text: q.text,
        options: q.options || ['', '', '', ''],
        correct: q.correct ?? 0,
      })),
    },
    {
      id: 2,
      title: 'Section B - Short Questions',
      type: 'Short',
      marks: selectedShort.length * 2,
      instructions: 'Answer briefly.',
      questions: selectedShort.map((q) => ({ id: generateId(), text: q.text })),
    },
    {
      id: 3,
      title: 'Section C - Long Questions',
      type: 'Long',
      marks: selectedLong.length * 5,
      instructions: 'Answer in detail.',
      questions: selectedLong.map((q) => ({ id: generateId(), text: q.text })),
    },
  ]
}

export function getPaperTotalMarks(sections) {
  return (sections || []).reduce((acc, section) => acc + (parseInt(section.marks, 10) || 0), 0)
}
