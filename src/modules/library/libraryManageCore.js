import {
  loadLibraryFromLocal,
  getAvailableCopies,
  getCurrentBorrowings,
  getBorrowingHistory,
  searchBooks,
} from './libraryCore'

export const LIBRARY_MANAGE_TABS = [
  { id: 'overview', l: 'Overview' },
  { id: 'catalog', l: 'Catalog' },
  { id: 'overdue', l: 'Overdue' },
  { id: 'members', l: 'Members' },
  { id: 'fines', l: 'Fines' },
  { id: 'reports', l: 'Reports' },
]

export const LIBRARY_RULES_KEY = 'psms_library_rules'
export const LIBRARY_FINES_KEY = 'psms_library_fine_payments'

export const DEFAULT_LIBRARY_RULES = {
  loanDays: 14,
  finePerDay: 5,
  maxBooksPerStudent: 3,
}

function newId(prefix = 'lib') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

function dayStart(isoOrDate) {
  const d = isoOrDate instanceof Date ? new Date(isoOrDate) : new Date(isoOrDate || Date.now())
  if (Number.isNaN(d.getTime())) return null
  d.setHours(0, 0, 0, 0)
  return d
}

export function loadLibraryRules(schoolId) {
  try {
    if (typeof window === 'undefined' || !schoolId) return { ...DEFAULT_LIBRARY_RULES }
    const raw = window.localStorage.getItem(LIBRARY_RULES_KEY)
    if (!raw) return { ...DEFAULT_LIBRARY_RULES }
    const data = JSON.parse(raw)
    const row = data?.[schoolId] || {}
    return {
      loanDays: Number(row.loanDays) > 0 ? Number(row.loanDays) : DEFAULT_LIBRARY_RULES.loanDays,
      finePerDay: Number(row.finePerDay) >= 0 ? Number(row.finePerDay) : DEFAULT_LIBRARY_RULES.finePerDay,
      maxBooksPerStudent:
        Number(row.maxBooksPerStudent) > 0
          ? Number(row.maxBooksPerStudent)
          : DEFAULT_LIBRARY_RULES.maxBooksPerStudent,
    }
  } catch {
    return { ...DEFAULT_LIBRARY_RULES }
  }
}

export function saveLibraryRules(schoolId, rules) {
  try {
    if (typeof window === 'undefined' || !schoolId) return
    const raw = window.localStorage.getItem(LIBRARY_RULES_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[schoolId] = {
      loanDays: Number(rules.loanDays) > 0 ? Number(rules.loanDays) : DEFAULT_LIBRARY_RULES.loanDays,
      finePerDay: Number(rules.finePerDay) >= 0 ? Number(rules.finePerDay) : DEFAULT_LIBRARY_RULES.finePerDay,
      maxBooksPerStudent:
        Number(rules.maxBooksPerStudent) > 0
          ? Number(rules.maxBooksPerStudent)
          : DEFAULT_LIBRARY_RULES.maxBooksPerStudent,
    }
    window.localStorage.setItem(LIBRARY_RULES_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function loadFinePayments(schoolId) {
  try {
    if (typeof window === 'undefined' || !schoolId) return []
    const raw = window.localStorage.getItem(LIBRARY_FINES_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data?.[schoolId]) ? data[schoolId] : []
  } catch {
    return []
  }
}

export function saveFinePayments(schoolId, list) {
  try {
    if (typeof window === 'undefined' || !schoolId) return
    const raw = window.localStorage.getItem(LIBRARY_FINES_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[schoolId] = Array.isArray(list) ? list : []
    window.localStorage.setItem(LIBRARY_FINES_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function getBorrowerName(borrowing) {
  return String(borrowing?.studentName || borrowing?.borrowerName || '').trim() || 'Borrower'
}

export function getDueDate(borrowing, loanDays = DEFAULT_LIBRARY_RULES.loanDays) {
  if (borrowing?.dueDate) {
    const d = dayStart(borrowing.dueDate)
    if (d) return d
  }
  const issued = dayStart(borrowing?.issuedAt)
  if (!issued) return null
  const due = new Date(issued)
  due.setDate(due.getDate() + (Number(loanDays) || DEFAULT_LIBRARY_RULES.loanDays))
  return due
}

export function daysOverdue(borrowing, { loanDays = DEFAULT_LIBRARY_RULES.loanDays, asOf = new Date() } = {}) {
  if (borrowing?.returnedAt) return 0
  const due = getDueDate(borrowing, loanDays)
  const today = dayStart(asOf)
  if (!due || !today) return 0
  const diff = Math.floor((today - due) / (24 * 60 * 60 * 1000))
  return diff > 0 ? diff : 0
}

export function calculateFine(borrowing, { loanDays, finePerDay, asOf } = {}) {
  const days = daysOverdue(borrowing, { loanDays, asOf })
  const rate = Number(finePerDay)
  const perDay = Number.isFinite(rate) && rate >= 0 ? rate : DEFAULT_LIBRARY_RULES.finePerDay
  return {
    days,
    amount: days * perDay,
    dueDate: getDueDate(borrowing, loanDays),
  }
}

export function enrichBorrowing(borrowing, books, rules) {
  const book = (books || []).find((b) => b.id === borrowing.bookId)
  const fine = calculateFine(borrowing, rules)
  return {
    ...borrowing,
    bookTitle: book?.title || 'Unknown book',
    bookAuthor: book?.author || '',
    borrowerDisplay: getBorrowerName(borrowing),
    overdueDays: fine.days,
    fineAmount: fine.amount,
    dueDateIso: fine.dueDate ? fine.dueDate.toISOString().slice(0, 10) : '',
    isOverdue: fine.days > 0 && !borrowing.returnedAt,
  }
}

export function summarizeLibrary(schoolId, rules) {
  const data = loadLibraryFromLocal(schoolId)
  const books = data.books || []
  const borrowings = data.borrowings || []
  const active = getCurrentBorrowings(borrowings)
  const history = getBorrowingHistory(borrowings)
  const overdue = active
    .map((b) => enrichBorrowing(b, books, rules))
    .filter((b) => b.isOverdue)
  const totalCopies = books.reduce((s, b) => s + (Number(b.copies) || 1), 0)
  const available = books.reduce((s, b) => s + getAvailableCopies(b, borrowings), 0)
  const fineTotal = overdue.reduce((s, b) => s + b.fineAmount, 0)
  return {
    bookCount: books.length,
    totalCopies,
    availableCopies: available,
    issuedCount: active.length,
    returnedCount: history.length,
    overdueCount: overdue.length,
    fineTotal,
    books,
    borrowings,
    active,
    overdue,
  }
}

export function listOverdue(schoolId, rules) {
  const data = loadLibraryFromLocal(schoolId)
  return getCurrentBorrowings(data.borrowings || [])
    .map((b) => enrichBorrowing(b, data.books, rules))
    .filter((b) => b.isOverdue)
    .sort((a, b) => b.overdueDays - a.overdueDays)
}

export function listMembers(schoolId, rules) {
  const data = loadLibraryFromLocal(schoolId)
  const books = data.books || []
  const active = getCurrentBorrowings(data.borrowings || [])
  const map = new Map()
  active.forEach((b) => {
    const key = [
      getBorrowerName(b).toLowerCase(),
      String(b.roll || '').trim(),
      String(b.className || '').trim(),
    ].join('|')
    if (!map.has(key)) {
      map.set(key, {
        id: key,
        name: getBorrowerName(b),
        fatherName: b.fatherName || '',
        roll: b.roll || '',
        className: b.className || '',
        activeCount: 0,
        overdueCount: 0,
        fineAmount: 0,
        books: [],
      })
    }
    const row = map.get(key)
    const enriched = enrichBorrowing(b, books, rules)
    row.activeCount += 1
    if (enriched.isOverdue) {
      row.overdueCount += 1
      row.fineAmount += enriched.fineAmount
    }
    row.books.push(enriched.bookTitle)
  })
  return [...map.values()].sort((a, b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))
}

export function addFinePayment(list, { borrowerName, amount, note, borrowingId }) {
  const entry = {
    id: newId('fine'),
    borrowerName: String(borrowerName || '').trim() || 'Borrower',
    amount: Number(amount) || 0,
    note: String(note || '').trim(),
    borrowingId: borrowingId || null,
    paidAt: new Date().toISOString(),
  }
  if (entry.amount <= 0) return Array.isArray(list) ? list : []
  return [entry, ...(Array.isArray(list) ? list : [])]
}

export function removeFinePayment(list, id) {
  return (Array.isArray(list) ? list : []).filter((p) => p.id !== id)
}

export function buildCirculationReport(schoolId, rules) {
  const data = loadLibraryFromLocal(schoolId)
  const books = data.books || []
  const borrowings = data.borrowings || []
  const byBook = books.map((book) => {
    const related = borrowings.filter((b) => b.bookId === book.id)
    const active = related.filter((b) => !b.returnedAt).length
    const total = related.length
    return {
      id: book.id,
      title: book.title || 'Untitled',
      author: book.author || '',
      copies: book.copies || 1,
      available: getAvailableCopies(book, borrowings),
      timesIssued: total,
      currentlyOut: active,
    }
  })
  const topIssued = [...byBook].sort((a, b) => b.timesIssued - a.timesIssued).slice(0, 10)
  const lowStock = byBook.filter((b) => b.available === 0).sort((a, b) => a.title.localeCompare(b.title))
  const summary = summarizeLibrary(schoolId, rules)
  return { topIssued, lowStock, summary, byBook }
}

export function searchCatalog(schoolId, query) {
  const data = loadLibraryFromLocal(schoolId)
  return searchBooks(data.books || [], query).map((book) => ({
    ...book,
    available: getAvailableCopies(book, data.borrowings || []),
  }))
}
