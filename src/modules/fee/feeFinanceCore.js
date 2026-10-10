import { resolveClass, formatClassDisplay } from '../systemSettings/systemSettingsCore'
import {
  FEE_AMOUNT,
  getClassFeeSummary,
  getStudentFeeStatusForClass,
  getMonthsList,
  formatCurrency,
  getMonthlyFeeRecords,
} from './feeCore'

export const FEE_FINANCE_TABS = [
  { id: 'overview', l: 'Overview' },
  { id: 'collection', l: 'Collection' },
  { id: 'dues', l: 'Dues' },
  { id: 'receipts', l: 'Receipts' },
  { id: 'concessions', l: 'Concessions' },
  { id: 'expenses', l: 'Expenses' },
  { id: 'reports', l: 'Reports' },
]

export const CONCESSION_TYPES = ['Full waiver', 'Half fee', 'Sibling discount', 'Staff child', 'Scholarship', 'Other']
export const EXPENSE_CATEGORIES = ['Utilities', 'Supplies', 'Maintenance', 'Salaries', 'Events', 'Transport', 'Other']

export const FEE_CONCESSIONS_KEY = 'system_management_fee_concessions'
export const FEE_EXPENSES_KEY = 'system_management_expenses'

function newId(prefix = 'fin') {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`
}

export function getEffectiveFeeAmount(settings) {
  const n = Number(settings?.feeAmount)
  if (Number.isFinite(n) && n >= 0) return n
  return FEE_AMOUNT
}

export function loadConcessions(schoolId) {
  try {
    if (typeof window === 'undefined' || !schoolId) return []
    const raw = window.localStorage.getItem(FEE_CONCESSIONS_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data?.[schoolId]) ? data[schoolId] : []
  } catch {
    return []
  }
}

export function saveConcessions(schoolId, list) {
  try {
    if (typeof window === 'undefined' || !schoolId) return
    const raw = window.localStorage.getItem(FEE_CONCESSIONS_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[schoolId] = Array.isArray(list) ? list : []
    window.localStorage.setItem(FEE_CONCESSIONS_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function loadExpenses(schoolId) {
  try {
    if (typeof window === 'undefined' || !schoolId) return []
    const raw = window.localStorage.getItem(FEE_EXPENSES_KEY)
    if (!raw) return []
    const data = JSON.parse(raw)
    return Array.isArray(data?.[schoolId]) ? data[schoolId] : []
  } catch {
    return []
  }
}

export function saveExpenses(schoolId, list) {
  try {
    if (typeof window === 'undefined' || !schoolId) return
    const raw = window.localStorage.getItem(FEE_EXPENSES_KEY)
    const data = raw ? JSON.parse(raw) : {}
    data[schoolId] = Array.isArray(list) ? list : []
    window.localStorage.setItem(FEE_EXPENSES_KEY, JSON.stringify(data))
  } catch {
    /* ignore */
  }
}

export function addConcession(list, { studentId, type, mode, value, reason }) {
  const entry = {
    id: newId('conc'),
    studentId: String(studentId || ''),
    type: CONCESSION_TYPES.includes(type) ? type : 'Other',
    mode: mode === 'percent' ? 'percent' : 'amount',
    value: Number(value) || 0,
    reason: String(reason || '').trim(),
    createdAt: new Date().toISOString(),
  }
  if (!entry.studentId) return Array.isArray(list) ? list : []
  return [entry, ...(Array.isArray(list) ? list : [])]
}

export function removeConcession(list, id) {
  return (Array.isArray(list) ? list : []).filter((c) => c.id !== id)
}

export function getStudentConcession(concessions, studentId) {
  return (Array.isArray(concessions) ? concessions : []).find((c) => String(c.studentId) === String(studentId)) || null
}

export function applyConcessionToAmount(baseAmount, concession) {
  if (!concession) return baseAmount
  if (concession.mode === 'percent') {
    const pct = Math.min(100, Math.max(0, Number(concession.value) || 0))
    return Math.max(0, Math.round(baseAmount * (1 - pct / 100)))
  }
  return Math.max(0, baseAmount - (Number(concession.value) || 0))
}

export function addExpense(list, { title, category, amount, date, notes }) {
  const entry = {
    id: newId('exp'),
    title: String(title || '').trim() || 'Expense',
    category: EXPENSE_CATEGORIES.includes(category) ? category : 'Other',
    amount: Number(amount) || 0,
    date: String(date || new Date().toISOString().slice(0, 10)),
    notes: String(notes || '').trim(),
    createdAt: new Date().toISOString(),
  }
  if (entry.amount <= 0) return Array.isArray(list) ? list : []
  return [entry, ...(Array.isArray(list) ? list : [])].sort((a, b) => String(b.date).localeCompare(String(a.date)))
}

export function removeExpense(list, id) {
  return (Array.isArray(list) ? list : []).filter((e) => e.id !== id)
}

export function buildDuesList({ feeRecords, students, classes, month, year, concessions = [], feeAmount = FEE_AMOUNT }) {
  const rows = []
  ;(Array.isArray(students) ? students : []).forEach((s) => {
    const cls = resolveClass(classes, s.classId)
    if (!cls) return
    const status = getStudentFeeStatusForClass(feeRecords, {
      classId: cls.id,
      studentId: s.id,
      month,
      year,
    })
    if (status.paid) return
    const conc = getStudentConcession(concessions, s.id)
    const due = applyConcessionToAmount(feeAmount, conc)
    rows.push({
      studentId: s.id,
      name: s.name || 'Student',
      fatherName: s.fatherName || '',
      rollNo: s.rollNo || '',
      admissionNo: s.admissionNo || '',
      classId: cls.id,
      classLabel: formatClassDisplay(cls),
      dueAmount: due,
      concession: conc,
    })
  })
  return rows.sort((a, b) =>
    String(a.classLabel).localeCompare(String(b.classLabel)) ||
    String(a.rollNo).localeCompare(String(b.rollNo), undefined, { numeric: true }),
  )
}

export function buildReceiptsList({ feeRecords, students, classes, month, year }) {
  const monthly = getMonthlyFeeRecords(feeRecords, month, year)
  const studentMap = new Map((Array.isArray(students) ? students : []).map((s) => [String(s.id), s]))
  return monthly
    .map((rec) => {
      const s = studentMap.get(String(rec.studentId))
      const cls = resolveClass(classes, rec.classId) || resolveClass(classes, s?.classId)
      return {
        id: rec.id,
        receiptNo: String(rec.id || '').replace(/^fee_/, 'R-').slice(0, 18),
        studentId: rec.studentId,
        name: s?.name || 'Student',
        rollNo: s?.rollNo || '',
        classLabel: formatClassDisplay(cls) || String(rec.classId || ''),
        amount: rec.amount || FEE_AMOUNT,
        paidAt: rec.paidAt || '',
        month: rec.month,
        year: rec.year,
      }
    })
    .sort((a, b) => String(b.paidAt).localeCompare(String(a.paidAt)))
}

export function summarizeFeeFinance({
  feeRecords,
  students,
  classes,
  month,
  year,
  expenses = [],
  concessions = [],
  feeAmount = FEE_AMOUNT,
}) {
  const classSummary = getClassFeeSummary(feeRecords, classes, month, year, students)
  const paidCount = classSummary.reduce((s, c) => s + c.paidCount, 0)
  const totalStudents = classSummary.reduce((s, c) => s + c.totalStudents, 0)
  // Records store actual paid amounts; expected uses configured fee amount
  const collected = (Array.isArray(feeRecords) ? feeRecords : [])
    .filter((r) => r.month === month && r.year === year)
    .reduce((s, r) => s + (Number(r.amount) || 0), 0)
  const expected = totalStudents * feeAmount
  const dues = buildDuesList({ feeRecords, students, classes, month, year, concessions, feeAmount })
  const adjustedPending = dues.reduce((s, d) => s + d.dueAmount, 0)
  const monthExpenses = (Array.isArray(expenses) ? expenses : []).filter((e) => {
    const d = String(e.date || '')
    if (!/^\d{4}-\d{2}/.test(d)) return false
    const [y, m] = d.split('-').map(Number)
    return y === year && m === month
  })
  const expenseTotal = monthExpenses.reduce((s, e) => s + (Number(e.amount) || 0), 0)
  return {
    expected,
    collected,
    pending: adjustedPending,
    rate: expected > 0 ? Math.round((collected / expected) * 100) : 0,
    paidCount,
    totalStudents,
    duesCount: dues.length,
    concessionCount: Array.isArray(concessions) ? concessions.length : 0,
    expenseTotal,
    net: collected - expenseTotal,
    classSummary,
  }
}

export function buildYearlyFeeTrend(feeRecords, { year, students, classes, feeAmount = FEE_AMOUNT }) {
  return getMonthsList().map((m) => {
    const summary = getClassFeeSummary(feeRecords, classes, m.value, year, students)
    const collected = summary.reduce((s, c) => s + c.collectedAmount, 0)
    const expected = summary.reduce((s, c) => s + c.expectedAmount, 0)
    // If feeAmount differs from FEE_AMOUNT constant used in getClassFeeSummary, scale
    const scale = FEE_AMOUNT > 0 ? feeAmount / FEE_AMOUNT : 1
    return {
      month: m.value,
      label: m.label.slice(0, 3),
      collected: Math.round(collected * scale),
      expected: Math.round(expected * scale),
    }
  })
}

export function expenseTotalsByCategory(expenses, { month, year } = {}) {
  const map = {}
  EXPENSE_CATEGORIES.forEach((c) => {
    map[c] = 0
  })
  ;(Array.isArray(expenses) ? expenses : []).forEach((e) => {
    if (month != null && year != null) {
      const d = String(e.date || '')
      const [y, m] = d.split('-').map(Number)
      if (y !== year || m !== month) return
    }
    const cat = EXPENSE_CATEGORIES.includes(e.category) ? e.category : 'Other'
    map[cat] = (map[cat] || 0) + (Number(e.amount) || 0)
  })
  return Object.entries(map)
    .filter(([, v]) => v > 0)
    .map(([category, amount]) => ({ category, amount }))
    .sort((a, b) => b.amount - a.amount)
}

export { getMonthsList, formatCurrency }
